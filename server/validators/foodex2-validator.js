// Main FoodEx2 validator that combines VBA and Business Rules validation
const VBAValidator = require('./vba-validator');
const BusinessRulesValidator = require('./business-rules-validator');
const DataLoader = require('./data-loader');
const path = require('path');

class FoodEx2Validator {
    constructor(db, options = {}) {
        this.db = db;
        this.options = {
            context: options.context || 'ICT', // ICT, DCF, internal, external
            dataPath: options.dataPath || path.join(__dirname, '../../data'),
            skipBusinessRules: options.skipBusinessRules || false,
            skipVBAValidation: options.skipVBAValidation || false,
            ...options
        };

        // Initialize validators
        this.vbaValidator = new VBAValidator(db);
        this.dataLoader = new DataLoader(this.options.dataPath);
        
        // These will be initialized after data is loaded
        this.businessRulesValidator = null;
        this.dataLoaded = false;
    }

    /**
     * Initialize the validator by loading necessary data
     */
    async initialize() {
        if (this.dataLoaded) return;

        try {
            // Ensure data files exist
            await this.dataLoader.ensureDataFiles();

            // Load all data
            const { forbiddenProcesses, warningMessages, warningColors } = 
                await this.dataLoader.loadAllData();

            // Initialize business rules validator
            this.businessRulesValidator = new BusinessRulesValidator(
                this.db,
                warningMessages,
                forbiddenProcesses
            );

            this.warningColors = warningColors;
            this.dataLoaded = true;
        } catch (error) {
            console.error('Error initializing validator:', error);
            throw error;
        }
    }

    /**
     * Validate a complete FoodEx2 code
     * @param {string} fullCode - Complete code (e.g., "A0EZF#F01.A077V$F28.A07XS")
     * @returns {Object} Validation result
     */
    async validateCode(fullCode) {
        await this.initialize();

        // Parse the code
        const { baseTermCode, facetString } = this.parseFullCode(fullCode);

        // Run VBA validation first
        const vbaResult = await this.runVBAValidation(baseTermCode, facetString);
        
        if (!vbaResult.valid && this.options.stopOnStructuralError) {
            return await this.formatResult(vbaResult, null);
        }

        // Run business rules validation
        const brResult = await this.runBusinessRulesValidation(
            vbaResult.baseTerm,
            vbaResult.cleanedFacets || []
        );

        // Combine results
        return await this.formatResult(vbaResult, brResult);
    }

    /**
     * Validate multiple codes in batch
     */
    async validateBatch(codes, progressCallback) {
        await this.initialize();

        const results = [];
        const total = codes.length;

        for (let i = 0; i < codes.length; i++) {
            const result = await this.validateCode(codes[i]);
            results.push({
                code: codes[i],
                ...result
            });

            if (progressCallback) {
                progressCallback(i + 1, total);
            }
        }

        return results;
    }

    /**
     * Parse full code into base term and facets
     */
    parseFullCode(fullCode) {
        if (!fullCode || fullCode.length < 5) {
            return { baseTermCode: fullCode || '', facetString: '' };
        }

        // Base term is first 5 characters
        const baseTermCode = fullCode.substring(0, 5);
        const facetString = fullCode.substring(5);

        return { baseTermCode, facetString };
    }

    /**
     * Run VBA-style structural validation
     */
    async runVBAValidation(baseTermCode, facetString) {
        if (this.options.skipVBAValidation) {
            // Return minimal result for business rules to work
            const term = await this.db.get(
                'SELECT * FROM terms WHERE code = ?', 
                [baseTermCode]
            );
            return {
                valid: true,
                warnings: [],
                baseTerm: term,
                cleanedFacets: this.vbaValidator.parseFacetString(facetString)
            };
        }

        return await this.vbaValidator.validateFoodEx2Code(baseTermCode, facetString);
    }

    /**
     * Run business rules validation
     */
    async runBusinessRulesValidation(baseTerm, facets) {
        if (this.options.skipBusinessRules || !baseTerm) {
            return { warnings: [] };
        }

        const warnings = await this.businessRulesValidator.validateBusinessRules(
            baseTerm,
            facets,
            this.options.context
        );

        return { warnings };
    }

    /**
     * Format the final result
     */
    async formatResult(vbaResult, brResult) {
        // Combine all warnings
        const allWarnings = [
            ...vbaResult.warnings,
            ...(brResult ? brResult.warnings : [])
        ];

        // Calculate overall severity
        const overallSeverity = this.getOverallSeverity(allWarnings);

        // Determine if valid
        const hasErrors = allWarnings.some(w => w.severity === 'ERROR');
        const hasHighWarnings = allWarnings.some(w => w.severity === 'HIGH');
        const isValid = !hasErrors && (!hasHighWarnings || !!this.options.allowHighWarnings);

        // Get interpreted description
        const interpretedDescription = vbaResult.baseTerm ? 
            await this.getInterpretedDescription(vbaResult.baseTerm, vbaResult.cleanedFacets || []) : 
            null;

        return {
            valid: isValid,
            originalCode: vbaResult.originalCode,
            cleanedCode: vbaResult.cleanedCode,
            baseTerm: vbaResult.baseTerm,
            facets: vbaResult.cleanedFacets || [],
            interpretedDescription,
            warnings: allWarnings,
            severity: overallSeverity,
            warningCounts: this.getWarningCounts(allWarnings),
            semaphoreColor: this.getSemaphoreColor(overallSeverity)
        };
    }

    /**
     * Get overall severity level
     */
    getOverallSeverity(warnings) {
        if (warnings.some(w => w.severity === 'ERROR')) return 'ERROR';
        if (warnings.some(w => w.severity === 'HIGH')) return 'HIGH';
        if (warnings.some(w => w.severity === 'LOW')) return 'LOW';
        return 'NONE';
    }

    /**
     * Get warning counts by severity
     */
    getWarningCounts(warnings) {
        return {
            error: warnings.filter(w => w.severity === 'ERROR').length,
            high: warnings.filter(w => w.severity === 'HIGH').length,
            low: warnings.filter(w => w.severity === 'LOW').length,
            total: warnings.length
        };
    }

    /**
     * Get semaphore color based on severity
     */
    getSemaphoreColor(severity) {
        if (!this.warningColors) return null;
        return this.warningColors[severity] || this.warningColors['NONE'];
    }

    /**
     * Get interpreted description for a validated code
     */
    async getInterpretedDescription(baseTerm, facets) {
        if (!baseTerm) return null;

        let description = baseTerm.name || baseTerm.extended_name;

        // Add facet descriptions
        for (const facet of facets) {
            const [groupId, descriptorCode] = facet.split('.');
            
            // Get facet group name
            const groupName = await this.getFacetGroupName(groupId);
            
            // Get descriptor name
            const descriptor = await this.db.get(
                'SELECT extended_name as name FROM terms WHERE term_code = ?',
                [descriptorCode]
            );

            if (groupName && descriptor) {
                description += `, ${groupName} = ${descriptor.name}`;
            }
        }

        return description;
    }

    /**
     * Get facet group name
     */
    async getFacetGroupName(groupId) {
        const groupNames = {
            'F01': 'Source',
            'F02': 'Part consumed/analysed',
            'F03': 'Physical state',
            'F04': 'Ingredient',
            'F27': 'Source-commodities',
            'F28': 'Process'
            // Add more as needed
        };

        return groupNames[groupId] || groupId;
    }

    /**
     * Export validation results to Excel-compatible format
     */
    formatForExcel(results) {
        return results.map(result => ({
            'FoodEx2 Code': result.code,
            'Valid': result.valid ? 'Yes' : 'No',
            'Base Term': result.baseTerm ? result.baseTerm.code : '',
            'Base Term Name': result.baseTerm ? result.baseTerm.name : '',
            'Interpreted': result.interpretedDescription || '',
            'Warning Level': result.severity,
            'Warning Count': result.warningCounts.total,
            'Warnings': result.warnings.map(w => w.message).join('; '),
            'Cleaned Code': result.cleanedCode || result.originalCode
        }));
    }

    /**
     * Get validation statistics
     */
    getValidationStats(results) {
        const total = results.length;
        const valid = results.filter(r => r.valid).length;
        const errors = results.filter(r => r.severity === 'ERROR').length;
        const highWarnings = results.filter(r => r.severity === 'HIGH').length;
        const lowWarnings = results.filter(r => r.severity === 'LOW').length;

        return {
            total,
            valid,
            invalid: total - valid,
            errors,
            highWarnings,
            lowWarnings,
            successRate: ((valid / total) * 100).toFixed(2) + '%'
        };
    }
}

// Export a factory function for easy initialization
FoodEx2Validator.create = async function(db, options) {
    const validator = new FoodEx2Validator(db, options);
    await validator.initialize();
    return validator;
};

module.exports = FoodEx2Validator;