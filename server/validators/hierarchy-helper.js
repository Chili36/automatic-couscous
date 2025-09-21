// Database helper functions for hierarchy checks and term relationships

class HierarchyHelper {
    constructor(db) {
        this.db = db;
        // Cache for performance
        this.ancestorCache = new Map();
        this.hierarchyCache = new Map();
    }

    /**
     * Check if a term is a child of another term in a specific hierarchy
     */
    async isChildOf(childCode, parentCode, hierarchyCode) {
        if (childCode === parentCode) return false;

        const ancestors = await this.getAncestors(childCode, hierarchyCode);
        return ancestors.includes(parentCode);
    }

    /**
     * Check if a term is a child of any of the provided parent terms
     */
    async isChildOfAny(childCode, parentCodes, hierarchyCode) {
        const ancestors = await this.getAncestors(childCode, hierarchyCode);
        return parentCodes.some(parent => ancestors.includes(parent));
    }

    /**
     * Check if a term is a parent of another term
     */
    async isParentOf(parentCode, childCode, hierarchyCode) {
        return this.isChildOf(childCode, parentCode, hierarchyCode);
    }

    /**
     * Get all ancestors of a term in a specific hierarchy
     */
    async getAncestors(termCode, hierarchyCode) {
        const cacheKey = `${termCode}:${hierarchyCode}`;
        
        if (this.ancestorCache.has(cacheKey)) {
            return this.ancestorCache.get(cacheKey);
        }

        const ancestors = await this.db.all(`
            WITH RECURSIVE ancestors AS (
                -- Direct parent
                SELECT parent_code as ancestor_code, 1 as level
                FROM term_hierarchies
                WHERE term_code = ? AND hierarchy_code = ?
                
                UNION
                
                -- Recursive parents
                SELECT thr.parent_code, a.level + 1
                FROM term_hierarchies thr
                JOIN ancestors a ON thr.term_code = a.ancestor_code
                WHERE thr.hierarchy_code = ?
            )
            SELECT DISTINCT ancestor_code FROM ancestors
            ORDER BY level
        `, [termCode, hierarchyCode, hierarchyCode]);

        const ancestorCodes = ancestors.map(a => a.ancestor_code);
        this.ancestorCache.set(cacheKey, ancestorCodes);
        
        return ancestorCodes;
    }

    /**
     * Get all descendants of a term in a specific hierarchy
     */
    async getDescendants(termCode, hierarchyCode) {
        const descendants = await this.db.all(`
            WITH RECURSIVE descendants AS (
                -- Direct children
                SELECT term_code as descendant_code, 1 as level
                FROM term_hierarchies
                WHERE parent_code = ? AND hierarchy_code = ?
                
                UNION
                
                -- Recursive children
                SELECT thr.term_code, d.level + 1
                FROM term_hierarchies thr
                JOIN descendants d ON thr.parent_code = d.descendant_code
                WHERE thr.hierarchy_code = ?
            )
            SELECT DISTINCT descendant_code FROM descendants
            ORDER BY level
        `, [termCode, hierarchyCode, hierarchyCode]);

        return descendants.map(d => d.descendant_code);
    }

    /**
     * Check if a term belongs to a specific hierarchy
     */
    async belongsToHierarchy(termCode, hierarchyCode) {
        const result = await this.db.get(`
            SELECT 1 FROM term_hierarchies
            WHERE term_code = ? AND hierarchy_code = ?
            LIMIT 1
        `, [termCode, hierarchyCode]);

        return !!result;
    }

    /**
     * Get the parent of a term in a specific hierarchy
     */
    async getParent(termCode, hierarchyCode) {
        const result = await this.db.get(`
            SELECT parent_code FROM term_hierarchies
            WHERE term_code = ? AND hierarchy_code = ?
        `, [termCode, hierarchyCode]);

        return result ? result.parent_code : null;
    }

    /**
     * Check if two terms are siblings (have same parent)
     */
    async areSiblings(term1Code, term2Code, hierarchyCode) {
        const parent1 = await this.getParent(term1Code, hierarchyCode);
        const parent2 = await this.getParent(term2Code, hierarchyCode);
        
        return parent1 && parent2 && parent1 === parent2;
    }

    /**
     * Get hierarchy information
     */
    async getHierarchy(hierarchyCode) {
        if (this.hierarchyCache.has(hierarchyCode)) {
            return this.hierarchyCache.get(hierarchyCode);
        }

        const hierarchy = await this.db.get(`
            SELECT * FROM hierarchies WHERE code = ?
        `, [hierarchyCode]);

        if (hierarchy) {
            this.hierarchyCache.set(hierarchyCode, hierarchy);
        }

        return hierarchy;
    }

    /**
     * Check if a term is a raw commodity
     */
    isRawCommodity(term) {
        return term.type === 'r';
    }

    /**
     * Check if a term is a derivative
     */
    isDerivative(term) {
        return term.type === 'd';
    }

    /**
     * Check if a term is composite
     */
    isComposite(term) {
        return term.type === 'c' || term.type === 's';
    }

    /**
     * Check if a term is a hierarchy term
     */
    isHierarchyTerm(term) {
        return term.detail_level === 'H';
    }

    /**
     * Check if a term is a facet
     */
    isFacetTerm(term) {
        return term.term_type === 'f';
    }

    /**
     * Check if a term is non-specific
     */
    isNonSpecific(term) {
        // Only check term_type 'n' as the definitive marker for non-specific terms
        // Terms like "Sheep other slaughtering products" are specific terms that happen to have "other" in their name
        return term.term_type === 'n';
    }

    /**
     * Parse implicit facets from a term
     */
    parseImplicitFacets(implicitFacetsString) {
        if (!implicitFacetsString) return [];
        return implicitFacetsString.split('$').filter(f => f);
    }

    /**
     * Check if term is concentrate/powder/dehydrated
     */
    isConcentrateOrPowder(term) {
        const indicators = ['concentrate', 'powder', 'dried', 'dehydrated'];
        const termName = term.name || term.extended_name || '';
        return indicators.some(ind => 
            termName.toLowerCase().includes(ind)
        );
    }

    /**
     * Clear caches (useful for testing or when data changes)
     */
    clearCache() {
        this.ancestorCache.clear();
        this.hierarchyCache.clear();
    }
}

module.exports = HierarchyHelper;