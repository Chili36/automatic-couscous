// VBA-style structural validation for FoodEx2 codes
// Implements the validation logic from FacetChecker.bas and BasetermChecker.bas

class VBAValidator {
    constructor(db) {
        this.db = db;
        // Single cardinality facet groups
        this.SINGLE_CARDINALITY_GROUPS = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32', 'F34'];
    }

    /**
     * Main validation entry point - validates a complete FoodEx2 code
     * @param {string} baseTermCode - 5-character base term code
     * @param {string} facetString - Facet string with # and $ separators
     * @returns {Object} Validation result with warnings and cleaned code
     */
    async validateFoodEx2Code(baseTermCode, facetString) {
        const warnings = [];
        
        try {
            // 1. Validate base term
            const baseTermResult = await this.checkBaseTerm(baseTermCode, warnings);
            if (!baseTermResult.valid) {
            return { 
                valid: false, 
                warnings,
                originalCode: baseTermCode + facetString,
                cleanedCode: null,
                baseTerm: null
            };
        }

        // 2. Parse facets (handle both # and $ separators)
        const facets = this.parseFacetString(facetString);
        
        // 3. Validate facet structure
        if (!this.checkCorrectFacet(facets, warnings)) {
            return { 
                valid: false, 
                warnings,
                originalCode: baseTermCode + facetString,
                cleanedCode: null,
                baseTerm: baseTermResult.term
            };
        }

        // 4. Get implicit facets for the base term
        const implicitFacets = await this.getImplicitFacets(baseTermResult.term);
        
        // 5. Remove implicit facets
        const { cleanedFacets, implicitRemoved } = this.checkAndRemoveImplicitFacets(
            facets, 
            implicitFacets, 
            warnings
        );

        // 6. Validate facet descriptors exist
        const validatedFacets = [];
        for (const facet of cleanedFacets) {
            const isValid = await this.validateFacetDescriptor(facet, warnings);
            if (isValid) {
                validatedFacets.push(facet);
            }
        }

        // 7. Check single cardinality rules
        this.checkSingleCardinalityFacets(validatedFacets, warnings);

        // 8. Check for duplicate facets
        this.checkDuplicateFacets(validatedFacets, warnings);

        // 9. Build final code
        const finalCode = baseTermCode + this.buildFacetString(validatedFacets);
        
        return {
            valid: warnings.filter(w => w.severity === 'ERROR').length === 0,
            warnings,
            originalCode: baseTermCode + facetString,
            cleanedCode: implicitRemoved ? finalCode : null,
            cleanedFacets: validatedFacets,
            baseTerm: baseTermResult.term
        };
        } catch (error) {
            console.error('VBA Validation error:', error);
            throw error;
        }
    }

    /**
     * Check if base term is valid (VBA: checkBaseterm)
     */
    async checkBaseTerm(baseTermCode, warnings) {
        // Check for invalid characters (only alphanumeric allowed)
        if (!/^[A-Z0-9]{5}$/.test(baseTermCode)) {
            warnings.push({
                rule: 'VBA-STRUCT',
                message: 'Base term contains invalid characters or wrong length (must be 5 alphanumeric characters)',
                severity: 'ERROR',
                type: 'STRUCTURE'
            });
            return { valid: false, term: null };
        }

        // Check if term exists in database
        const term = await this.db.get(`
            SELECT term_code as code, extended_name as name, term_type as type, 
                   detail_level, deprecated, 
                   CASE WHEN status = 'DISMISSED' THEN 1 ELSE 0 END as dismissed,
                   implicit_facets, term_type
            FROM terms 
            WHERE term_code = ?
        `, [baseTermCode]);

        if (!term) {
            warnings.push({
                rule: 'VBA-NOTFOUND',
                message: `Base term ${baseTermCode} not found in database`,
                severity: 'ERROR',
                type: 'NOT_FOUND'
            });
            return { valid: false, term: null };
        }

        return { valid: true, term };
    }

    /**
     * Parse facet string handling # and $ separators
     */
    parseFacetString(facetString) {
        if (!facetString) return [];
        
        // Split by # or $ and filter empty strings
        const facets = facetString.split(/[#$]/).filter(f => f.trim());
        return facets;
    }

    /**
     * Check facet structure (VBA: checkCorrectFacet)
     */
    checkCorrectFacet(facets, warnings) {
        let isValid = true;

        for (const facet of facets) {
            const parts = facet.split('.');
            
            // Check for missing dot separator
            if (parts.length !== 2) {
                warnings.push({
                    rule: 'VBA-FORMAT',
                    message: `Invalid facet format: Expected '.' separator in '${facet}' (format should be Fxx.YYYYY)`,
                    severity: 'ERROR',
                    type: 'STRUCTURE'
                });
                isValid = false;
                continue;
            }

            const [groupId, descriptor] = parts;

            // Check facet group format (Fxx - F followed by 2 digits)
            if (!/^F\d{2}$/.test(groupId)) {
                warnings.push({
                    rule: 'VBA-GROUP',
                    message: `Invalid facet group '${groupId}' (must be F followed by 2 digits, e.g., F01, F28)`,
                    severity: 'ERROR',
                    type: 'STRUCTURE'
                });
                isValid = false;
                continue;
            }

            // Check descriptor format (5 alphanumeric characters)
            if (!/^[A-Z0-9]{5}$/.test(descriptor)) {
                warnings.push({
                    rule: 'VBA-DESCRIPTOR',
                    message: `Invalid facet descriptor '${descriptor}' in ${groupId} (must be 5 alphanumeric characters)`,
                    severity: 'ERROR',
                    type: 'STRUCTURE'
                });
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * Get implicit facets for a term
     */
    async getImplicitFacets(term) {
        if (!term.implicit_facets) return [];
        
        // Parse implicit facets string (format: "F01.XXXXX$F27.YYYYY")
        return term.implicit_facets.split('$').filter(f => f);
    }

    /**
     * Check and remove implicit facets (VBA: checkFacets)
     */
    checkAndRemoveImplicitFacets(explicitFacets, implicitFacets, warnings) {
        const cleanedFacets = [];
        let implicitRemoved = false;

        for (const facet of explicitFacets) {
            // Check if this facet is implicit
            if (implicitFacets.includes(facet)) {
                implicitRemoved = true;
            } else {
                cleanedFacets.push(facet);
            }
        }

        if (implicitRemoved) {
            warnings.push({
                rule: 'VBA-IMPLICIT',
                message: 'Implicit facets were automatically removed (already included in base term)',
                severity: 'HIGH',
                type: 'IMPLICIT_REMOVED'
            });
        }

        return { cleanedFacets, implicitRemoved };
    }

    /**
     * Validate facet descriptor exists in database
     */
    async validateFacetDescriptor(facetCode, warnings) {
        const [groupId, descriptor] = facetCode.split('.');
        
        const term = await this.db.get(`
            SELECT term_code as code, extended_name as name 
            FROM terms 
            WHERE term_code = ?
        `, [descriptor]);

        if (!term) {
            warnings.push({
                rule: 'VBA-FACET404',
                message: `Facet descriptor '${descriptor}' not found in database`,
                severity: 'ERROR',
                type: 'NOT_FOUND',
                facet: facetCode
            });
            return false;
        }

        // Map facet group to hierarchy code (from attributes table)
        // IMPORTANT: These mappings come directly from the database attributes table
        const hierarchyMap = {
            'F01': 'source',
            'F02': 'part',
            'F03': 'state',      // Physical state
            'F04': 'ingred',
            'F06': 'medium',
            'F07': 'fat',
            'F08': 'sweet',
            'F09': 'fort',
            'F10': 'qual',
            'F11': 'alcohol',
            'F12': 'dough',
            'F17': 'cookext',
            'F18': 'packformat',
            'F19': 'packmat',
            'F20': 'partcon',    // Part consumed/analysed
            'F21': 'prod',
            'F22': 'place',
            'F23': 'targcon',
            'F24': 'use',
            'F25': 'riskingred',
            'F26': 'gen',
            'F27': 'racsource',
            'F28': 'process',
            'F29': 'fpurpose',
            'F30': 'replev',
            'F31': 'animage',
            'F32': 'gender',
            'F33': 'legis',
            'F34': 'hostsampled'
        };

        const hierarchyCode = hierarchyMap[groupId] || groupId.toLowerCase();
        
        // Also validate it belongs to the correct facet group hierarchy
        const belongsToGroup = await this.db.get(`
            SELECT 1 
            FROM term_hierarchies 
            WHERE term_code = ? 
            AND hierarchy_code = ?
        `, [descriptor, hierarchyCode]);

        if (!belongsToGroup) {
            // Get the friendly names for the facet group
            const facetGroupNames = {
                'F01': 'Source (animal/plant origin)',
                'F02': 'Part-nature (part of plant/animal)',
                'F03': 'Physical state',
                'F04': 'Ingredient',
                'F05': 'Reserved',  // Not used in current schema
                'F06': 'Medium',
                'F07': 'Fat content',
                'F08': 'Sweetening agent',
                'F09': 'Fortification agent',
                'F10': 'Qualitative info',
                'F11': 'Alcohol content',
                'F12': 'Dough',
                'F13': 'Reserved',  // Not used
                'F14': 'Reserved',  // Not used
                'F15': 'Reserved',  // Not used
                'F16': 'Reserved',  // Not used
                'F17': 'Extent of cooking',
                'F18': 'Packing format',
                'F19': 'Packing material',
                'F20': 'Part consumed/analysed (form when consumed)',
                'F21': 'Production method',
                'F22': 'Preparation/production place',
                'F23': 'Target consumer',
                'F24': 'Use/Intended use',
                'F25': 'Risk ingredient',
                'F26': 'Generic term',
                'F27': 'Source commodities',
                'F28': 'Process',
                'F29': 'Purpose of raising/breeding',
                'F30': 'Reporting level',
                'F31': 'Animal age',
                'F32': 'Gender',
                'F33': 'Legislative classes',
                'F34': 'Host sampled'
            };

            const groupName = facetGroupNames[groupId] || groupId;

            // Find which hierarchies this descriptor actually belongs to
            const correctGroups = await this.db.all(`
                SELECT DISTINCT hierarchy_code
                FROM term_hierarchies
                WHERE term_code = ?
            `, [descriptor]);

            // Map hierarchy codes back to facet groups
            // These must match the hierarchyMap above in reverse
            const hierarchyToFacetMap = {
                'source': 'F01',
                'part': 'F02',       // Part-nature (part of plant/animal)
                'state': 'F03',      // Physical state
                'ingred': 'F04',
                'medium': 'F06',
                'fat': 'F07',
                'sweet': 'F08',
                'fort': 'F09',       // Fortification
                'qual': 'F10',       // Qualitative info
                'alcohol': 'F11',
                'dough': 'F12',
                'cookext': 'F17',    // Extent of cooking
                'packformat': 'F18', // Packing format
                'packmat': 'F19',    // Packing material
                'partcon': 'F20',    // Part consumed/analysed
                'prod': 'F21',       // Production method
                'place': 'F22',
                'targcon': 'F23',    // Target consumer
                'use': 'F24',
                'riskingred': 'F25', // Risk ingredient
                'gen': 'F26',        // Generic term
                'racsource': 'F27',
                'process': 'F28',
                'fpurpose': 'F29',   // Purpose of raising/breeding
                'replev': 'F30',     // Reporting level
                'animage': 'F31',    // Animal age
                'gender': 'F32',
                'legis': 'F33',      // Legislative classes
                'hostsampled': 'F34' // Host sampled
            };

            const validFacetGroups = [];
            for (const row of correctGroups) {
                const facetGroup = Object.entries(hierarchyToFacetMap).find(([h, f]) => h === row.hierarchy_code)?.[1];
                if (facetGroup && facetGroupNames[facetGroup]) {
                    validFacetGroups.push(`${facetGroup} (${facetGroupNames[facetGroup]})`);
                }
            }

            let suggestion = '';
            if (validFacetGroups.length > 0) {
                suggestion = ` This term belongs to: ${validFacetGroups.join(', ')}.`;
            }

            warnings.push({
                rule: 'VBA-CATEGORY',
                message: `'${descriptor}' (${term.name}) is not valid for ${groupId} (${groupName}).${suggestion} (BR31)`,
                severity: 'ERROR',
                type: 'WRONG_CATEGORY',
                facet: facetCode,
                termName: term.name,
                groupName: groupName,
                validGroups: validFacetGroups
            });
            return false;
        }

        return true;
    }

    /**
     * Check single cardinality facets (VBA: part of addFacetInfo)
     */
    checkSingleCardinalityFacets(facets, warnings) {
        const facetGroups = {};

        // Count occurrences of each facet group
        for (const facet of facets) {
            const groupId = facet.split('.')[0];
            facetGroups[groupId] = (facetGroups[groupId] || 0) + 1;
        }

        // Check for violations
        for (const [groupId, count] of Object.entries(facetGroups)) {
            if (this.SINGLE_CARDINALITY_GROUPS.includes(groupId) && count > 1) {
                warnings.push({
                    rule: 'VBA-CARDINALITY',
                    message: `Multiple instances of facet group ${groupId} not allowed (BR25: Single cardinality enforcement)`,
                    severity: 'HIGH',
                    type: 'CARDINALITY_VIOLATION'
                });
            }
        }
    }

    /**
     * Check for duplicate facets
     */
    checkDuplicateFacets(facets, warnings) {
        const seen = new Set();
        const duplicates = new Set();

        for (const facet of facets) {
            if (seen.has(facet)) {
                duplicates.add(facet);
            }
            seen.add(facet);
        }

        for (const duplicate of duplicates) {
            warnings.push({
                rule: 'VBA-DUPLICATE',
                message: `Duplicate facet '${duplicate}' found (same facet cannot be used multiple times)`,
                severity: 'HIGH',
                type: 'DUPLICATE_FACET'
            });
        }
    }

    /**
     * Build facet string with proper separators (VBA: addFacetInfo)
     */
    buildFacetString(facets) {
        if (facets.length === 0) return '';
        
        return facets.map((facet, index) => {
            const separator = index === 0 ? '#' : '$';
            return separator + facet;
        }).join('');
    }

    /**
     * Check if base term is special type (feed-related)
     * VBA: checkFeed - highlights feed in results
     */
    checkIfFeedRelated(term) {
        const termName = term.name || term.extended_name || '';
        return termName.toLowerCase().includes('feed');
    }

    /**
     * Get interpreted description for display (VBA: part of addFacetInfo)
     */
    async getInterpretedDescription(baseTerm, facets) {
        let result = baseTerm.name;

        for (const facet of facets) {
            const [groupId, descriptor] = facet.split('.');
            
            // Get facet group name
            const facetGroup = await this.db.get(`
                SELECT name FROM facet_groups WHERE code = ?
            `, [groupId]);

            // Get facet descriptor name
            const facetTerm = await this.db.get(`
                SELECT name FROM terms WHERE code = ?
            `, [descriptor]);

            if (facetGroup && facetTerm) {
                result += `, ${facetGroup.name} = ${facetTerm.name}`;
            }
        }

        // Special handling for feed terms
        if (this.checkIfFeedRelated(baseTerm)) {
            result = result.replace(/feed/gi, '**feed**');
        }

        return result;
    }
}

module.exports = VBAValidator;