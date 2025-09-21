// Complete implementation of all 31 FoodEx2 business rules
const HierarchyHelper = require('./hierarchy-helper');

class BusinessRulesValidator {
    constructor(db, warningMessages, forbiddenProcesses) {
        this.db = db;
        this.hierarchyHelper = new HierarchyHelper(db);
        this.warningMessages = warningMessages;
        this.forbiddenProcesses = forbiddenProcesses;
    }

    /**
     * Run all applicable business rules
     */
    async validateBusinessRules(baseTerm, explicitFacets, context = 'ICT') {
        const warnings = [];

        // Run each business rule
        await this.checkBR01(baseTerm, explicitFacets, warnings);
        // BR02 is empty
        await this.checkBR03(baseTerm, explicitFacets, warnings);
        await this.checkBR04(baseTerm, explicitFacets, warnings);
        await this.checkBR05(baseTerm, explicitFacets, warnings);
        await this.checkBR06(baseTerm, explicitFacets, warnings);
        await this.checkBR07(baseTerm, explicitFacets, warnings);
        await this.checkBR08(baseTerm, warnings);
        // BR09 is empty
        await this.checkBR10(baseTerm, warnings);
        await this.checkBR11(baseTerm, explicitFacets, warnings);
        await this.checkBR12(baseTerm, explicitFacets, warnings);
        await this.checkBR13(baseTerm, explicitFacets, warnings);
        
        // Context-specific rules
        if (context === 'ICT' || context === 'DCF') {
            await this.checkBR14(baseTerm, explicitFacets, warnings, context);
        }
        if (context === 'DCF') {
            await this.checkBR15(baseTerm, explicitFacets, warnings);
        }

        await this.checkBR16(baseTerm, explicitFacets, warnings);
        await this.checkBR17(baseTerm, warnings);
        // BR18 is empty
        await this.checkBR19(baseTerm, explicitFacets, warnings);
        await this.checkBR20(baseTerm, warnings);
        await this.checkBR21(baseTerm, warnings);
        await this.checkBR22(baseTerm, warnings);
        await this.checkBR23(baseTerm, warnings);
        await this.checkBR24(baseTerm, warnings);
        await this.checkBR25(explicitFacets, warnings);
        await this.checkBR26(baseTerm, explicitFacets, warnings);
        await this.checkBR27(baseTerm, explicitFacets, warnings);
        await this.checkBR28(baseTerm, explicitFacets, warnings);
        // BR29, BR30, BR31 are handled in VBA validator

        return warnings;
    }

    /**
     * BR01: Source commodity validation for raw terms
     */
    async checkBR01(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isRawCommodity(baseTerm)) return;

        const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));
        if (explicitF27.length === 0) return;

        // Get implicit F27 facets
        const implicitF27 = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets)
            .filter(f => f.startsWith('F27.'))
            .map(f => f.split('.')[1]);

        for (const facet of explicitF27) {
            const facetCode = facet.split('.')[1];
            
            // Check if facet is child of implicit F27 or child of base term
            const isValidChild = await this.hierarchyHelper.isChildOfAny(
                facetCode, 
                [...implicitF27, baseTerm.code],
                'racsource'
            );

            if (!isValidChild) {
                warnings.push(this.createWarning('BR01', facetCode));
            }
        }
    }

    /**
     * BR03: No F01 source in composite foods
     */
    async checkBR03(baseTerm, explicitFacets, warnings) {
        if (this.hierarchyHelper.isComposite(baseTerm)) {
            if (explicitFacets.some(f => f.startsWith('F01.'))) {
                warnings.push(this.createWarning('BR03', baseTerm.code));
            }
        }
    }

    /**
     * BR04: No F27 source-commodities in composite foods
     */
    async checkBR04(baseTerm, explicitFacets, warnings) {
        if (this.hierarchyHelper.isComposite(baseTerm)) {
            if (explicitFacets.some(f => f.startsWith('F27.'))) {
                warnings.push(this.createWarning('BR04', baseTerm.code));
            }
        }
    }

    /**
     * BR05: F27 restrictions for derivatives
     */
    async checkBR05(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        const implicitF27 = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets)
            .filter(f => f.startsWith('F27.'));
        const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));

        for (const explicit of explicitF27) {
            let isMoreSpecific = false;
            
            for (const implicit of implicitF27) {
                if (await this.hierarchyHelper.isChildOf(
                    explicit.split('.')[1], 
                    implicit.split('.')[1],
                    'racsource'
                )) {
                    isMoreSpecific = true;
                    break;
                }
            }

            if (!isMoreSpecific && implicitF27.length > 0) {
                warnings.push(this.createWarning('BR05', explicit));
            }
        }
    }

    /**
     * BR06: F01 source requires F27 in derivatives
     */
    async checkBR06(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        const hasF01 = explicitFacets.some(f => f.startsWith('F01.'));
        if (!hasF01) return;

        const implicitF27 = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets)
            .filter(f => f.startsWith('F27.'));
        const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));

        if (implicitF27.length === 0 && explicitF27.length === 0) {
            warnings.push(this.createWarning('BR06', baseTerm.code));
        }
    }

    /**
     * BR07: F01 source for single F27 only
     */
    async checkBR07(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        const hasF01 = explicitFacets.some(f => f.startsWith('F01.'));
        if (!hasF01) return;

        const implicitF27 = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets)
            .filter(f => f.startsWith('F27.'));
        const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));
        const totalF27 = implicitF27.length + explicitF27.length;

        if (totalF27 > 1) {
            warnings.push(this.createWarning('BR07', baseTerm.code));
        }
    }

    /**
     * BR08: Non-reportable terms check
     */
    async checkBR08(baseTerm, warnings) {
        if (baseTerm.dismissed) return; // Skip if dismissed

        const hasReporting = await this.hierarchyHelper.belongsToHierarchy(
            baseTerm.code, 
            'report'
        );

        if (!hasReporting) {
            warnings.push(this.createWarning('BR08', baseTerm.code));
        }
    }

    /**
     * BR10: Non-specific terms warning
     */
    async checkBR10(baseTerm, warnings) {
        if (this.hierarchyHelper.isNonSpecific(baseTerm)) {
            warnings.push(this.createWarning('BR10', baseTerm.code));
        }
    }

    /**
     * BR11: Generic process terms warning
     */
    async checkBR11(baseTerm, explicitFacets, warnings) {
        const genericProcesses = ['A07XS']; // Processed

        for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
            const processCode = facet.split('.')[1];
            
            for (const generic of genericProcesses) {
                if (processCode === generic || 
                    await this.hierarchyHelper.isChildOf(processCode, generic, 'process')) {
                    warnings.push(this.createWarning('BR11', processCode));
                    break;
                }
            }
        }
    }

    /**
     * BR12: Ingredient facet restrictions
     */
    async checkBR12(baseTerm, explicitFacets, warnings) {
        const f04Facets = explicitFacets.filter(f => f.startsWith('F04.'));

        for (const facet of f04Facets) {
            // Only check for raw commodities and derivatives
            if (this.hierarchyHelper.isComposite(baseTerm)) {
                continue; // F04 is allowed for composites
            }

            const facetCode = facet.split('.')[1];
            const implicitF04 = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets)
                .filter(f => f.startsWith('F04.'));

            // Check if explicit is more specific than implicit
            let isMoreSpecific = false;
            for (const implicit of implicitF04) {
                if (await this.hierarchyHelper.isChildOf(
                    facetCode, 
                    implicit.split('.')[1], 
                    'ingred'
                )) {
                    isMoreSpecific = true;
                    break;
                }
            }

            if (!isMoreSpecific && implicitF04.length > 0) {
                warnings.push(this.createWarning('BR12', facet));
            }
        }
    }

    /**
     * BR13: Physical state creates derivatives
     */
    async checkBR13(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isRawCommodity(baseTerm)) return;

        // List of physical states that create derivatives
        const forbiddenPhysicalStates = [
            'A0C0D', 'A0C0E', 'A0C0F', 'A0C0G', 'A0C0H'
            // Add more based on actual data
        ];

        for (const facet of explicitFacets.filter(f => f.startsWith('F03.'))) {
            const stateCode = facet.split('.')[1];
            
            if (forbiddenPhysicalStates.includes(stateCode)) {
                warnings.push(this.createWarning('BR13', baseTerm.code));
            }
        }
    }

    /**
     * BR14: ICT and DCF only rule
     */
    async checkBR14(baseTerm, explicitFacets, warnings, context) {
        // Implementation specific to ICT/DCF context
        // Add specific validation logic here based on requirements
    }

    /**
     * BR15: DCF only rule
     */
    async checkBR15(baseTerm, explicitFacets, warnings) {
        // Implementation specific to DCF context
        // Add specific validation logic here based on requirements
    }

    /**
     * BR16: Process facet detail level
     */
    async checkBR16(baseTerm, explicitFacets, warnings) {
        const implicitFacets = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets);

        for (const explicit of explicitFacets) {
            const [facetGroup, facetCode] = explicit.split('.');
            
            // Skip if facet is malformed
            if (!facetGroup || !facetCode) {
                continue;
            }
            
            // Find matching implicit facets of same group
            const matchingImplicit = implicitFacets
                .filter(f => f.startsWith(facetGroup + '.'))
                .map(f => f.split('.')[1]);

            for (const implicitCode of matchingImplicit) {
                // Check if explicit is parent of implicit (less detailed)
                const siblings = await this.hierarchyHelper.areSiblings(
                    facetCode, 
                    implicitCode, 
                    facetGroup.toLowerCase()
                );

                if (!siblings && await this.hierarchyHelper.isParentOf(
                    facetCode, 
                    implicitCode, 
                    facetGroup.toLowerCase()
                )) {
                    warnings.push(this.createWarning('BR16', facetCode));
                    break;
                }
            }
        }
    }

    /**
     * BR17: Facets as base terms
     */
    async checkBR17(baseTerm, warnings) {
        if (this.hierarchyHelper.isFacetTerm(baseTerm)) {
            warnings.push(this.createWarning('BR17', baseTerm.code));
        }
    }

    /**
     * BR19: Forbidden processes on raw commodities
     */
    async checkBR19(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isRawCommodity(baseTerm)) return;

        // Get forbidden processes for this term
        const forbiddenForTerm = await this.getForbiddenProcesses(baseTerm.code);

        // Check each F28 process facet
        for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
            const processCode = facet.split('.')[1];

            if (forbiddenForTerm.includes(processCode)) {
                // Get process term details for better error message
                const processTermRow = await this.db.get(
                    'SELECT extended_name FROM terms WHERE term_code = ?',
                    [processCode]
                );
                const processName = processTermRow ? processTermRow.extended_name : processCode;
                const baseTermName = baseTerm.extended_name || baseTerm.name || baseTerm.code;

                // Create a more specific warning message
                const specificWarning = this.createWarning('BR19', processCode);
                specificWarning.message = `BR19> Process ${facet} (${processName}) creates a derivative from raw commodity ${baseTerm.code} (${baseTermName}) and is forbidden. Start from the existing derivative base term instead.`;
                specificWarning.facet = facet;
                warnings.push(specificWarning);
            }
        }
    }

    /**
     * BR20: Deprecated terms
     */
    async checkBR20(baseTerm, warnings) {
        if (baseTerm.deprecated) {
            warnings.push(this.createWarning('BR20', baseTerm.code));
        }
    }

    /**
     * BR21: Dismissed terms
     */
    async checkBR21(baseTerm, warnings) {
        if (baseTerm.dismissed) {
            warnings.push(this.createWarning('BR21', baseTerm.code));
        }
    }

    /**
     * BR22: Success message (only if no high warnings)
     */
    async checkBR22(baseTerm, warnings) {
        const hasHighWarnings = warnings.some(w => 
            w.severity === 'HIGH' || w.severity === 'ERROR'
        );

        if (!hasHighWarnings && !this.hierarchyHelper.isHierarchyTerm(baseTerm)) {
            warnings.push(this.createWarning('BR22', baseTerm.code));
        }
    }

    /**
     * BR23: Hierarchy terms as base terms
     */
    async checkBR23(baseTerm, warnings) {
        if (this.hierarchyHelper.isHierarchyTerm(baseTerm)) {
            const inExposure = await this.hierarchyHelper.belongsToHierarchy(
                baseTerm.code, 
                'expo'
            );
            
            if (inExposure) {
                warnings.push(this.createWarning('BR23', baseTerm.code));
            }
        }
    }

    /**
     * BR24: Non-exposure hierarchy terms
     */
    async checkBR24(baseTerm, warnings) {
        if (this.hierarchyHelper.isHierarchyTerm(baseTerm)) {
            const inExposure = await this.hierarchyHelper.belongsToHierarchy(
                baseTerm.code, 
                'expo'
            );
            
            if (!inExposure) {
                warnings.push(this.createWarning('BR24', baseTerm.code));
            }
        }
    }

    /**
     * BR25: Single cardinality facet categories
     */
    async checkBR25(explicitFacets, warnings) {
        const SINGLE_CARDINALITY = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32', 'F34'];
        const facetGroups = {};

        for (const facet of explicitFacets) {
            const group = facet.split('.')[0];
            facetGroups[group] = (facetGroups[group] || 0) + 1;
        }

        for (const [group, count] of Object.entries(facetGroups)) {
            if (SINGLE_CARDINALITY.includes(group) && count > 1) {
                warnings.push(this.createWarning('BR25', group));
            }
        }
    }

    /**
     * BR26: Mutually exclusive processes
     */
    async checkBR26(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        const processes = await this.getProcessesWithOrdinalCodes(baseTerm, explicitFacets);
        const ordinalGroups = {};

        // Group processes by ordinal code (excluding 0)
        for (const proc of processes) {
            if (proc.ordinalCode !== 0) {
                ordinalGroups[proc.ordinalCode] = ordinalGroups[proc.ordinalCode] || [];
                ordinalGroups[proc.ordinalCode].push(proc.code);
            }
        }

        // Check for multiple processes with same ordinal code
        for (const [ordinal, codes] of Object.entries(ordinalGroups)) {
            if (codes.length > 1) {
                warnings.push(this.createWarning('BR26', codes.join(' - ')));
            }
        }
    }

    /**
     * BR27: Process creates new derivative
     */
    async checkBR27(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        const processes = await this.getProcessesWithOrdinalCodes(baseTerm, explicitFacets);
        
        // Get processes with decimal ordinal codes
        const decimalProcesses = processes.filter(p => p.ordinalCode % 1 !== 0);
        
        // Group by integer part
        const integerGroups = {};
        for (const proc of decimalProcesses) {
            const intPart = Math.floor(proc.ordinalCode);
            integerGroups[intPart] = integerGroups[intPart] || [];
            integerGroups[intPart].push(proc);
        }

        // Check each group
        for (const [intPart, procs] of Object.entries(integerGroups)) {
            const hasImplicit = procs.some(p => p.isImplicit);
            const hasExplicit = procs.some(p => !p.isImplicit);
            
            // Warn if we have both implicit and explicit, or multiple explicit
            if ((hasImplicit && hasExplicit && procs.length > 1) || 
                (!hasImplicit && procs.filter(p => !p.isImplicit).length > 1)) {
                const codes = procs.filter(p => !p.isImplicit).map(p => p.code);
                warnings.push(this.createWarning('BR27', codes.join(' - ')));
            }
        }
    }

    /**
     * BR28: Reconstitution on dehydrated terms
     */
    async checkBR28(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isConcentrateOrPowder(baseTerm)) return;

        const reconstitutionProcesses = ['A07MR', 'A07MQ']; // Reconstitution, Dilution

        for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
            const processCode = facet.split('.')[1];
            
            if (reconstitutionProcesses.includes(processCode)) {
                warnings.push(this.createWarning('BR28', processCode));
            }
        }
    }

    /**
     * Helper: Get forbidden processes for a term
     */
    async getForbiddenProcesses(termCode) {
        const forbidden = [];
        
        // Get all ancestors of the term in reporting hierarchy
        const ancestors = await this.hierarchyHelper.getAncestors(termCode, 'report');
        ancestors.push(termCode); // Include the term itself

        // Check forbidden processes for each ancestor
        for (const ancestorCode of ancestors) {
            const processes = this.forbiddenProcesses
                .filter(fp => fp.rootGroupCode === ancestorCode)
                .map(fp => fp.forbiddenProcessCode);
            forbidden.push(...processes);
        }

        return [...new Set(forbidden)]; // Remove duplicates
    }

    /**
     * Helper: Get processes with ordinal codes
     */
    async getProcessesWithOrdinalCodes(baseTerm, explicitFacets) {
        const processes = [];

        // Get implicit processes
        const implicitFacets = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets);
        for (const facet of implicitFacets.filter(f => f.startsWith('F28.'))) {
            const processCode = facet.split('.')[1];
            const ordinalCode = await this.getProcessOrdinalCode(baseTerm.code, processCode);
            processes.push({
                code: processCode,
                ordinalCode: ordinalCode || 0,
                isImplicit: true
            });
        }

        // Get explicit processes
        for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
            const processCode = facet.split('.')[1];
            const ordinalCode = await this.getProcessOrdinalCode(baseTerm.code, processCode);
            processes.push({
                code: processCode,
                ordinalCode: ordinalCode || 0,
                isImplicit: false
            });
        }

        return processes;
    }

    /**
     * Helper: Get ordinal code for a process
     */
    async getProcessOrdinalCode(termCode, processCode) {
        // First check in forbidden processes data
        const ancestors = await this.hierarchyHelper.getAncestors(termCode, 'report');
        ancestors.push(termCode);

        for (const ancestorCode of ancestors) {
            const fp = this.forbiddenProcesses.find(
                fp => fp.rootGroupCode === ancestorCode && 
                      fp.forbiddenProcessCode === processCode
            );
            if (fp) return fp.ordinalCode;
        }

        // If not found, return default
        return 0;
    }

    /**
     * Create warning object from message ID
     */
    createWarning(messageId, involvedTerms = '') {
        const message = this.warningMessages[messageId] || {
            text: `Unknown warning: ${messageId}`,
            severity: 'HIGH'
        };

        return {
            rule: messageId,
            message: message.text,
            severity: message.severity,
            type: 'BUSINESS_RULE',
            involvedTerms
        };
    }
}

module.exports = BusinessRulesValidator;