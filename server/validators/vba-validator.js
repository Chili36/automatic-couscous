// VBA-style structural validation for FoodEx2 codes
// Implements the validation logic from FacetChecker.bas and BasetermChecker.bas

class VBAValidator {
    constructor(db) {
        this.db = db;
        // Single cardinality facet groups
        this.SINGLE_CARDINALITY_GROUPS = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32'];
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
                message: '-Base term contains invalid characters or wrong length-',
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
                message: '-Base term not found-',
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
                    message: `-Expected '.' after facet group in ${facet}-`,
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
                    message: `-Facet group not correct (${groupId})-`,
                    severity: 'ERROR',
                    type: 'STRUCTURE'
                });
                isValid = false;
                continue;
            }

            // Check descriptor format (5 alphanumeric characters)
            if (!/^[A-Z0-9]{5}$/.test(descriptor)) {
                warnings.push({
                    message: `-Facet term not correct (${descriptor})-`,
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
                message: '-Implicit facet/s removed-',
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
                message: '-Facet descriptor not found-',
                severity: 'ERROR',
                type: 'NOT_FOUND',
                facet: facetCode
            });
            return false;
        }

        // Map facet group to hierarchy code
        const hierarchyMap = {
            'F01': 'source',
            'F02': 'part',
            'F03': 'physt',
            'F04': 'ingred',
            'F27': 'racsource',
            'F28': 'process'
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
            warnings.push({
                message: `-Facet ${descriptor} does not belong to category ${groupId}-`,
                severity: 'ERROR',
                type: 'WRONG_CATEGORY',
                facet: facetCode
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
                    message: `-Multiple instances of ${groupId} not allowed-`,
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
                message: `-Duplicate facet ${duplicate} found-`,
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