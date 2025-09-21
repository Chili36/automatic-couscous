// FoodEx2 validation service integrating the complete ICT validation logic
const Database = require('./database');
const FoodEx2Validator = require('./validators/foodex2-validator');

class FoodEx2Service {
    constructor() {
        this.db = null;
        this.validator = null;
    }

    async initialize() {
        // Initialize database
        this.db = new Database();
        await this.db.initialize();

        // Initialize validator with default options
        this.validator = await FoodEx2Validator.create(this.db, {
            context: 'ICT',
            dataPath: require('path').join(__dirname, '../data')
        });

        console.log('FoodEx2 validation service initialized');
    }

    /**
     * Validate a single FoodEx2 code
     */
    async validateCode(code, options = {}) {
        if (!this.validator) {
            throw new Error('Service not initialized');
        }

        // Override default options if provided
        const validatorOptions = {
            context: options.context || 'ICT',
            stopOnStructuralError: options.stopOnStructuralError !== false,
            allowHighWarnings: options.allowHighWarnings === true
        };

        // Create a new validator instance with custom options if needed
        const validator = options.context && options.context !== 'ICT' ? 
            await FoodEx2Validator.create(this.db, validatorOptions) : 
            this.validator;

        return await validator.validateCode(code);
    }

    /**
     * Validate multiple codes
     */
    async validateBatch(codes, options = {}) {
        if (!this.validator) {
            throw new Error('Service not initialized');
        }

        const progressCallback = options.onProgress || null;
        return await this.validator.validateBatch(codes, progressCallback);
    }

    /**
     * Search for terms
     */
    async searchTerms(query, options = {}) {
        const searchType = options.type || 'all';
        const limit = options.limit || 50;
        
        let sql;
        const params = [`%${query}%`];

        switch (searchType) {
            case 'baseTerm':
                sql = `
                    SELECT term_code as code, extended_name as name, term_type as type, detail_level, term_type
                    FROM terms 
                    WHERE (term_code LIKE ? OR extended_name LIKE ?)
                    AND term_type NOT IN ('f', 'h')
                    AND NOT deprecated
                    AND status != 'dismissed'
                    ORDER BY 
                        CASE WHEN term_code = ? THEN 0 ELSE 1 END,
                        CASE WHEN term_code LIKE ? THEN 0 ELSE 1 END,
                        extended_name
                    LIMIT ?
                `;
                params.push(`%${query}%`, query, `${query}%`, limit);
                break;

            case 'facet':
                sql = `
                    SELECT t.term_code as code, t.extended_name as name, thr.hierarchy_code as facet_group
                    FROM terms t
                    JOIN term_hierarchies thr ON t.term_code = thr.term_code
                    WHERE (t.term_code LIKE ? OR t.extended_name LIKE ?)
                    AND thr.hierarchy_code LIKE 'f%'
                    ORDER BY t.extended_name
                    LIMIT ?
                `;
                params.push(`%${query}%`, limit);
                break;

            default:
                sql = `
                    SELECT term_code as code, extended_name as name, term_type as type, detail_level, term_type
                    FROM terms 
                    WHERE term_code LIKE ? OR extended_name LIKE ?
                    ORDER BY 
                        CASE WHEN term_code = ? THEN 0 ELSE 1 END,
                        extended_name
                    LIMIT ?
                `;
                params.push(`%${query}%`, query, limit);
        }

        return await this.db.all(sql, params);
    }

    /**
     * Get term details including implicit facets
     */
    async getTermDetails(code) {
        const term = await this.db.get(`
            SELECT * FROM terms WHERE term_code = ?
        `, [code]);

        if (!term) return null;

        // Get hierarchy memberships
        const hierarchies = await this.db.all(`
            SELECT hierarchy_code, parent_code
            FROM term_hierarchies
            WHERE term_code = ?
        `, [code]);

        // Parse implicit facets
        const implicitFacets = term.implicit_facets ?
            await this.parseImplicitFacets(term.implicit_facets) : [];

        const normalizedTerm = this.normalizeTermRecord(term);

        return {
            ...term,
            ...normalizedTerm,
            hierarchies,
            implicitFacets
        };
    }

    /**
     * Parse and get details for implicit facets
     */
    async parseImplicitFacets(implicitFacetsString) {
        if (!implicitFacetsString) return [];

        const facetCodes = implicitFacetsString.split('$').filter(f => f);
        const facets = [];

        for (const facetCode of facetCodes) {
            const [groupId, descriptorCode] = facetCode.split('.');
            const descriptor = await this.db.get(
                'SELECT term_code as code, extended_name as name FROM terms WHERE term_code = ?',
                [descriptorCode]
            );

            if (descriptor) {
                facets.push({
                    facetCode,
                    groupId,
                    descriptor: descriptor.name,
                    descriptorCode
                });
            }
        }

        return facets;
    }

    /**
     * Normalize raw term database record to camelCase properties expected by services
     */
    normalizeTermRecord(term) {
        if (!term) return null;

        return {
            code: term.term_code,
            name: term.extended_name,
            shortName: term.short_name,
            scopeNote: term.scope_note,
            version: term.version,
            lastUpdate: term.last_update,
            validFrom: term.valid_from,
            validTo: term.valid_to,
            status: term.status,
            deprecated: term.deprecated === 1,
            dismissed: term.status === 'DISMISSED',
            scientificNames: term.scientific_names,
            commonNames: term.common_names,
            allFacets: term.all_facets,
            detailLevel: term.detail_level,
            type: term.term_type,
            isscaap: term.ISSCAAP,
            taxonomicCode: term.taxonomic_code,
            alpha3Code: term.alpha3_code,
            gemsCode: term.GEMS_code,
            matrixCode: term.matrix_code,
            langualCode: term.langual_code,
            foodexOldCode: term.foodex_old_code,
            prodTreat: term.prod_treat,
            prodMeth: term.prod_meth,
            prodPack: term.prod_pack,
            euringsCode: term.eurings_code,
            ifnCode: term.IFN_code,
            euFeedReg: term.EU_feed_reg,
            eppoCode: term.EPPO_code,
            vectorNetCode: term.vector_net_code,
            addfoodCode: term.ADDFOOD_code,
            implicitFacetsRaw: term.implicit_facets
        };
    }

    /**
     * Get validation statistics for the current session
     */
    getSessionStats() {
        // This could track validation statistics
        return {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            avgResponseTime: 0
        };
    }

    /**
     * Close the service
     */
    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}

module.exports = FoodEx2Service;