// Soft rules implementation for FoodEx2 validation
// These rules provide LOW severity warnings for data completeness and quality
const HierarchyHelper = require('./hierarchy-helper');

class SoftRulesValidator {
    constructor(db, warningMessages) {
        this.db = db;
        this.hierarchyHelper = new HierarchyHelper(db);
        this.warningMessages = warningMessages || {};
        this.initializeSoftRuleMessages();
    }

    /**
     * Initialize soft rule warning messages
     */
    initializeSoftRuleMessages() {
        this.softRuleMessages = {
            'SR1': {
                text: 'Info: When using a generic base term, consider adding facet F26.A07XE to indicate that the detailed term was missing',
                severity: 'NONE'
            },
            'SR2': {
                text: 'Info: Consider providing detailed description in free text field when using generic terms or multiple refinement facets',
                severity: 'NONE'
            },
            'SR3': {
                text: 'Info: F04 (Ingredient) detected on raw/derivative - ensure ingredient is in small, negligible amount (minor ingredient approach)',
                severity: 'NONE'
            },
            'SR4': {
                text: 'Info: Mixed raw commodities should use F27 (Source-commodities) instead of F01 (Source)',
                severity: 'NONE'
            },
            'SR5': {
                text: 'Info: Consider reporting both process (F28) and new physical state (F03) for mechanical processes that change physical state',
                severity: 'NONE'
            },
            'SR6': {
                text: 'Info: F33 (Legislative-classes) or F03 (Physical-state) may be required for additives/flavourings domain',
                severity: 'NONE'
            },
            'SR7': {
                text: 'Info: F01 (Source) facet is recommended for VMPR derivatives',
                severity: 'NONE'
            },
            'SR8': {
                text: 'Info: F17 (Extent-of-cooking) is recommended for high-temperature processed foods (acrylamide/furans monitoring)',
                severity: 'NONE'
            }
        };
    }

    /**
     * Run all soft rules
     */
    async validateSoftRules(baseTerm, explicitFacets, context = 'ICT', textInfo = '') {
        const warnings = [];

        // Run each soft rule
        await this.checkSR1(baseTerm, explicitFacets, warnings);
        await this.checkSR2(baseTerm, explicitFacets, textInfo, warnings);
        await this.checkSR3(baseTerm, explicitFacets, warnings);
        await this.checkSR4(baseTerm, explicitFacets, warnings);
        await this.checkSR5(baseTerm, explicitFacets, warnings);
        await this.checkSR6(baseTerm, explicitFacets, warnings);
        await this.checkSR7(baseTerm, explicitFacets, warnings);
        await this.checkSR8(baseTerm, explicitFacets, warnings);

        return warnings;
    }

    /**
     * SR1: Missing Generic Term Flag (F26.A07XE)
     * When using a generic term, F26.A07XE should be present
     */
    async checkSR1(baseTerm, explicitFacets, warnings) {
        // Check if base term is generic (Corex = 'M' or parent generic term)
        const isGenericTerm = await this.isGenericTerm(baseTerm);

        if (isGenericTerm) {
            const hasF26Flag = explicitFacets.some(f => f === 'F26.A07XE');

            if (!hasF26Flag) {
                warnings.push(this.createSoftWarning('SR1', baseTerm.code));
            }
        }
    }

    /**
     * SR2: Missing Contextual Text
     * Generic terms or terms with multiple refinements should have text info
     */
    async checkSR2(baseTerm, explicitFacets, textInfo, warnings) {
        const isGenericTerm = await this.isGenericTerm(baseTerm);

        // Check for multiple refinement facets (F27, F04)
        const refinementFacets = explicitFacets.filter(f =>
            f.startsWith('F27.') || f.startsWith('F04.')
        );

        const needsTextInfo = isGenericTerm || refinementFacets.length > 1;

        if (needsTextInfo && (!textInfo || textInfo.trim() === '')) {
            warnings.push(this.createSoftWarning('SR2', baseTerm.code));
        }
    }

    /**
     * SR3: Minor Ingredient Check (F04 on RPC/Derivative)
     * F04 on raw/derivative should be for minor ingredients only
     */
    async checkSR3(baseTerm, explicitFacets, warnings) {
        const isRawOrDerivative = this.hierarchyHelper.isRawCommodity(baseTerm) ||
                                  this.hierarchyHelper.isDerivative(baseTerm);

        if (isRawOrDerivative) {
            const hasF04 = explicitFacets.some(f => f.startsWith('F04.'));

            if (hasF04) {
                warnings.push(this.createSoftWarning('SR3', baseTerm.code));
            }
        }
    }

    /**
     * SR4: Source Facet Misuse on Mixed RPC
     * Mixed raw commodities should use F27, not F01
     */
    async checkSR4(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isRawCommodity(baseTerm)) return;

        const hasF01 = explicitFacets.some(f => f.startsWith('F01.'));
        const multipleF01 = explicitFacets.filter(f => f.startsWith('F01.')).length > 1;

        if (hasF01 && multipleF01) {
            warnings.push(this.createSoftWarning('SR4', baseTerm.code));
        }
    }

    /**
     * SR5: Mechanical Treatment Clarity
     * Mechanical processes changing physical state should report both F28 and F03
     */
    async checkSR5(baseTerm, explicitFacets, warnings) {
        const mechanicalProcesses = [
            'A0CRK', // Stirring
            'A07KY', // Mincing/chopping/cutting
            'A0BYT', // Grinding
            'A0C0N', // Blending
            'A0DQP'  // Homogenisation
        ];

        const hasF28 = explicitFacets.filter(f => f.startsWith('F28.'));
        const hasF03 = explicitFacets.some(f => f.startsWith('F03.'));

        for (const facet of hasF28) {
            const processCode = facet.split('.')[1];
            if (mechanicalProcesses.includes(processCode) && !hasF03) {
                warnings.push(this.createSoftWarning('SR5', processCode));
                break;
            }
        }
    }

    /**
     * SR6: Missing F33 or F03 for Additives/Flavourings
     * Certain food matrices need F33 or F03 for additives/flavourings domain
     */
    async checkSR6(baseTerm, explicitFacets, warnings) {
        // Food matrices commonly subject to additive/flavouring rules
        const additivesMatrices = await this.isAdditivesMatrix(baseTerm);

        if (additivesMatrices) {
            const hasF33 = explicitFacets.some(f => f.startsWith('F33.'));
            const hasF03 = explicitFacets.some(f => f.startsWith('F03.'));

            // Check if F03 is implicit
            const implicitFacets = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets);
            const hasImplicitF03 = implicitFacets.some(f => f.startsWith('F03.'));

            if (!hasF33 && !hasF03 && !hasImplicitF03) {
                warnings.push(this.createSoftWarning('SR6', baseTerm.code));
            }
        }
    }

    /**
     * SR7: Missing F01 for VMPR Derivative
     * VMPR derivatives need explicit F01 (Source) facet
     */
    async checkSR7(baseTerm, explicitFacets, warnings) {
        if (!this.hierarchyHelper.isDerivative(baseTerm)) return;

        // Check if it's a VMPR-related derivative (milk, egg derivatives)
        const isVMPRDerivative = await this.isVMPRDerivative(baseTerm);

        if (isVMPRDerivative) {
            const hasF01 = explicitFacets.some(f => f.startsWith('F01.'));

            // Check implicit F01
            const implicitFacets = this.hierarchyHelper.parseImplicitFacets(baseTerm.implicit_facets);
            const hasImplicitF01 = implicitFacets.some(f => f.startsWith('F01.'));

            if (!hasF01 && !hasImplicitF01) {
                warnings.push(this.createSoftWarning('SR7', baseTerm.code));
            }
        }
    }

    /**
     * SR8: Missing F17 for Acrylamide/Furans
     * High-temp processed foods need F17 (Extent-of-cooking)
     */
    async checkSR8(baseTerm, explicitFacets, warnings) {
        // High-temperature processed food matrices
        const highTempMatrices = await this.isHighTempProcessedFood(baseTerm);

        if (highTempMatrices) {
            const hasF17 = explicitFacets.some(f => f.startsWith('F17.'));

            if (!hasF17) {
                warnings.push(this.createSoftWarning('SR8', baseTerm.code));
            }
        }
    }

    /**
     * Helper: Check if term is generic
     */
    async isGenericTerm(baseTerm) {
        // Check if Corex = 'M' (generic) or 'P' (parent)
        // Since we don't have Corex in the database, we'll check term type and name patterns
        const termName = baseTerm.name || baseTerm.extended_name || baseTerm.short_name || '';

        // Generic term patterns
        const genericPatterns = [
            'other', 'unspecified', 'not otherwise', 'n.o.s', 'generic',
            'miscellaneous', 'various', 'mixed', 'assorted'
        ];

        return genericPatterns.some(pattern =>
            termName.toLowerCase().includes(pattern)
        );
    }

    /**
     * Helper: Check if term is additives/flavourings matrix
     */
    async isAdditivesMatrix(baseTerm) {
        // Use the already fetched term name instead of querying database
        const termName = baseTerm.name || baseTerm.extended_name || baseTerm.short_name || '';

        // Common additive/flavouring matrices
        const additivesPatterns = [
            'beverage', 'sauce', 'confection', 'candy', 'sweet', 'flavour'
        ];

        return additivesPatterns.some(pattern =>
            termName.toLowerCase().includes(pattern)
        );
    }

    /**
     * Helper: Check if term is VMPR derivative
     */
    async isVMPRDerivative(baseTerm) {
        const termName = baseTerm.name || baseTerm.extended_name || baseTerm.short_name || '';

        // VMPR derivative patterns (milk, egg products)
        const vmprPatterns = [
            'milk powder', 'dried milk', 'cheese', 'yogurt', 'butter',
            'egg powder', 'dried egg', 'egg white', 'egg yolk'
        ];

        return vmprPatterns.some(pattern =>
            termName.toLowerCase().includes(pattern)
        );
    }

    /**
     * Helper: Check if term is high-temp processed food
     */
    async isHighTempProcessedFood(baseTerm) {
        const termName = baseTerm.name || baseTerm.extended_name || baseTerm.short_name || '';

        // High-temp processed food patterns
        const highTempPatterns = [
            'baked', 'fried', 'roasted', 'toasted', 'grilled',
            'bakery', 'bread', 'biscuit', 'cookie', 'cracker',
            'potato chip', 'french fr', 'crisp', 'coffee'
        ];

        return highTempPatterns.some(pattern =>
            termName.toLowerCase().includes(pattern)
        );
    }

    /**
     * Create soft warning object
     */
    createSoftWarning(ruleId, involvedTerms = '') {
        const message = this.softRuleMessages[ruleId] || {
            text: `Unknown soft rule: ${ruleId}`,
            severity: 'NONE'
        };

        return {
            rule: ruleId,
            message: message.text,
            severity: 'NONE',
            type: 'INFO',
            involvedTerms
        };
    }
}

module.exports = SoftRulesValidator;