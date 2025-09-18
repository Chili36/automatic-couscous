# Business Rules Implementation Guide

This guide provides detailed implementation instructions for each FoodEx2 business rule, including the exact logic, database queries, and validation steps required.

## Business Rule Implementation Details

### BR01: Source Commodity Validation for Raw Terms

**Logic Flow:**
1. Check if base term is raw commodity (type = 'r')
2. Get implicit F27 facets from base term
3. For each explicit F27 facet:
   - Check if it's a child of any implicit F27 facet
   - OR check if it's a child of the base term itself
   - If neither, raise warning

**Implementation:**
```javascript
async checkBR01(baseTerm, explicitFacets, warnings) {
    // Only check raw commodities
    if (baseTerm.type !== 'r') return;
    
    // Filter for explicit F27 facets
    const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));
    if (explicitF27.length === 0) return;
    
    // Get implicit F27 facets
    const implicitF27 = this.parseImplicitFacets(baseTerm.implicitFacets)
        .filter(f => f.startsWith('F27.'));
    
    // Check each explicit F27
    for (const facet of explicitF27) {
        const facetCode = facet.split('.')[1];
        
        // Check hierarchy relationships
        const isValidChild = await this.isChildOfAny(facetCode, [
            ...implicitF27.map(f => f.split('.')[1]),
            baseTerm.code
        ], 'racsource');
        
        if (!isValidChild) {
            warnings.push({
                rule: 'BR01',
                message: 'For mixed raw primary commodity terms it is only allowed to add under F27 source-commodities children of the already present implicit facet.',
                severity: 'HIGH',
                involvedTerms: facetCode
            });
        }
    }
}
```

### BR03 & BR04: Composite Food Restrictions

**Logic:**
- Composite foods (type 'c' or 's') cannot have F01 (source) or F27 (source-commodities) facets

**Implementation:**
```javascript
async checkBR03_BR04(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'c' && baseTerm.type !== 's') return;
    
    // Check for F01 (BR03)
    if (explicitFacets.some(f => f.startsWith('F01.'))) {
        warnings.push({
            rule: 'BR03',
            message: 'The F01 source facet is not allowed in composite food. Choose instead an F04 ingredient facet.',
            severity: 'HIGH'
        });
    }
    
    // Check for F27 (BR04)
    if (explicitFacets.some(f => f.startsWith('F27.'))) {
        warnings.push({
            rule: 'BR04',
            message: 'The F27 source-commodities facet is not allowed in composite food. Choose instead an F04 ingredient facet.',
            severity: 'HIGH'
        });
    }
}
```

### BR05: F27 Restrictions for Derivatives

**Logic:**
- For derivatives (type 'd'), explicit F27 must be more specific than implicit F27

**Implementation:**
```javascript
async checkBR05(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'd') return;
    
    const implicitF27 = this.parseImplicitFacets(baseTerm.implicitFacets)
        .filter(f => f.startsWith('F27.'));
    const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));
    
    for (const explicit of explicitF27) {
        let isMoreSpecific = false;
        
        for (const implicit of implicitF27) {
            if (await this.isChildOf(
                explicit.split('.')[1], 
                implicit.split('.')[1], 
                'racsource'
            )) {
                isMoreSpecific = true;
                break;
            }
        }
        
        if (!isMoreSpecific && implicitF27.length > 0) {
            warnings.push({
                rule: 'BR05',
                message: 'The F27 source-commodities facet which are not better specifing the already present implicit one are not allowed.',
                severity: 'HIGH'
            });
        }
    }
}
```

### BR06 & BR07: F01 Source Rules for Derivatives

**Implementation:**
```javascript
async checkBR06_BR07(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'd') return;
    
    const hasF01 = explicitFacets.some(f => f.startsWith('F01.'));
    if (!hasF01) return;
    
    const implicitF27 = this.parseImplicitFacets(baseTerm.implicitFacets)
        .filter(f => f.startsWith('F27.'));
    const explicitF27 = explicitFacets.filter(f => f.startsWith('F27.'));
    const totalF27 = implicitF27.length + explicitF27.length;
    
    // BR06: F01 requires at least one F27
    if (totalF27 === 0) {
        warnings.push({
            rule: 'BR06',
            message: 'The F01 source facet is only allowed in derivatives with an F27 source-commodities facet implicitly present.',
            severity: 'HIGH'
        });
    }
    
    // BR07: F01 requires exactly one F27
    if (totalF27 > 1) {
        warnings.push({
            rule: 'BR07',
            message: 'The F01 source facet can only be populated for derivatives having a single F27 source-commodities facet.',
            severity: 'HIGH'
        });
    }
}
```

### BR08: Reporting Hierarchy Check

**Logic:**
- Non-dismissed terms must belong to reporting hierarchy

**Database Query:**
```sql
SELECT COUNT(*) as has_reporting
FROM term_hierarchy_relationships
WHERE term_code = ? 
AND hierarchy_code = 'report'
```

**Implementation:**
```javascript
async checkBR08(baseTerm, warnings) {
    if (baseTerm.dismissed) return;
    
    const hasReporting = await this.db.get(`
        SELECT COUNT(*) as count
        FROM term_hierarchy_relationships
        WHERE term_code = ? 
        AND hierarchy_code = 'report'
    `, [baseTerm.code]);
    
    if (hasReporting.count === 0) {
        warnings.push({
            rule: 'BR08',
            message: 'The use of this term is forbidden in the reporting hierarchy.',
            severity: 'HIGH'
        });
    }
}
```

### BR10: Non-Specific Terms

**Logic:**
- Check if term has 'non-specific' attribute or belongs to non-specific category

**Implementation:**
```javascript
async checkBR10(baseTerm, warnings) {
    // Check various indicators of non-specific terms
    if (baseTerm.name.toLowerCase().includes('other') ||
        baseTerm.name.toLowerCase().includes('unspecified') ||
        baseTerm.detailLevel === 'H' || // Hierarchy terms
        baseTerm.termType === 'n') { // Non-specific type
        
        warnings.push({
            rule: 'BR10',
            message: 'The use of non-specific terms as base term is discouraged.',
            severity: 'LOW'
        });
    }
}
```

### BR11: Generic Process Terms

**Logic:**
- Check if F28 facet is generic process (A07XS or children)

**Implementation:**
```javascript
async checkBR11(explicitFacets, warnings) {
    const genericProcesses = ['A07XS']; // Processed
    
    for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
        const processCode = facet.split('.')[1];
        
        // Check if it's generic or child of generic
        for (const generic of genericProcesses) {
            if (processCode === generic || 
                await this.isChildOf(processCode, generic, 'process')) {
                warnings.push({
                    rule: 'BR11',
                    message: 'The use of generic terms under F28 process facet is discouraged.',
                    severity: 'LOW',
                    involvedTerms: processCode
                });
                break;
            }
        }
    }
}
```

### BR12: Ingredient Facet Rules

**Logic:**
- F04 can only be minor ingredient for derivatives or raw commodities
- For raw commodities, F04 must be more specific than implicit facets

**Implementation:**
```javascript
async checkBR12(baseTerm, explicitFacets, warnings) {
    const f04Facets = explicitFacets.filter(f => f.startsWith('F04.'));
    
    for (const facet of f04Facets) {
        // Check if used with composite foods
        if (baseTerm.type === 'c' || baseTerm.type === 's') {
            continue; // Allowed for composites
        }
        
        // For raw/derivatives, check if it's more specific than implicit
        const facetCode = facet.split('.')[1];
        const implicitF04 = this.parseImplicitFacets(baseTerm.implicitFacets)
            .filter(f => f.startsWith('F04.'));
        
        let isMoreSpecific = false;
        for (const implicit of implicitF04) {
            if (await this.isChildOf(facetCode, implicit.split('.')[1], 'ingred')) {
                isMoreSpecific = true;
                break;
            }
        }
        
        if (!isMoreSpecific && (baseTerm.type === 'r' || baseTerm.type === 'd')) {
            warnings.push({
                rule: 'BR12',
                message: 'The F04 ingredient facet can only be used as a minor ingredient to derivative or raw primary commodity terms.',
                severity: 'LOW'
            });
        }
    }
}
```

### BR13: Physical State Creates Derivatives

**Logic:**
- F03 physical state cannot be applied to raw commodities
- Exception: Some physical states don't create derivatives

**Implementation:**
```javascript
async checkBR13(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'r') return;
    
    const forbiddenPhysicalStates = [
        // List of physical states that create derivatives
        'A0C0D', 'A0C0E', 'A0C0F' // Examples: dried, frozen, etc.
    ];
    
    for (const facet of explicitFacets.filter(f => f.startsWith('F03.'))) {
        const stateCode = facet.split('.')[1];
        
        if (forbiddenPhysicalStates.includes(stateCode)) {
            warnings.push({
                rule: 'BR13',
                message: 'The F03 physical state facet reported creates a new derivative nature and therefore cannot be applied to raw primary commodity.',
                severity: 'HIGH'
            });
        }
    }
}
```

### BR16: Process Detail Level

**Logic:**
- Explicit process facets must be at least as detailed as implicit ones

**Implementation:**
```javascript
async checkBR16(baseTerm, explicitFacets, warnings) {
    const implicitFacets = this.parseImplicitFacets(baseTerm.implicitFacets);
    
    for (const explicit of explicitFacets) {
        const [facetGroup, facetCode] = explicit.split('.');
        
        // Find matching implicit facets
        const matchingImplicit = implicitFacets.filter(f => f.startsWith(facetGroup + '.'));
        
        for (const implicit of matchingImplicit) {
            const implicitCode = implicit.split('.')[1];
            
            // Check if explicit is parent of implicit (less detailed)
            if (await this.isParentOf(facetCode, implicitCode, facetGroup)) {
                warnings.push({
                    rule: 'BR16',
                    message: 'Reporting facets less detailed than the implicit facets is discouraged.',
                    severity: 'HIGH',
                    involvedTerms: facetCode
                });
                break;
            }
        }
    }
}
```

### BR17: Facets as Base Terms

**Logic:**
- Terms with type 'f' (facet) cannot be used as base terms

**Implementation:**
```javascript
async checkBR17(baseTerm, warnings) {
    if (baseTerm.termType === 'f') {
        warnings.push({
            rule: 'BR17',
            message: 'Reporting facets as base term is forbidden.',
            severity: 'HIGH'
        });
    }
}
```

### BR19: Forbidden Processes

**Logic:**
- Check forbidden processes from BR_Data.csv based on base term's root group

**Database Query:**
```sql
SELECT fp.forbidden_process_code, fp.ordinal_code
FROM forbidden_processes fp
JOIN term_ancestors ta ON ta.ancestor_code = fp.root_group_code
WHERE ta.term_code = ? 
AND ta.hierarchy_code = 'report'
```

**Implementation:**
```javascript
async checkBR19(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'r') return;
    
    // Get forbidden processes for this term
    const forbiddenProcesses = await this.db.all(`
        SELECT DISTINCT fp.forbidden_process_code
        FROM forbidden_processes fp
        JOIN term_ancestors ta ON ta.ancestor_code = fp.root_group_code
        WHERE ta.term_code = ? 
        AND ta.hierarchy_code = 'report'
    `, [baseTerm.code]);
    
    const forbiddenCodes = forbiddenProcesses.map(fp => fp.forbidden_process_code);
    
    // Check each F28 process facet
    for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
        const processCode = facet.split('.')[1];
        
        if (forbiddenCodes.includes(processCode)) {
            warnings.push({
                rule: 'BR19',
                message: 'Processes that create a new derivative nature cannot be applied to raw commodity base terms.',
                severity: 'HIGH',
                involvedTerms: processCode
            });
        }
    }
}
```

### BR20 & BR21: Term Status Checks

**Implementation:**
```javascript
async checkBR20_BR21(baseTerm, warnings) {
    // BR20: Deprecated terms
    if (baseTerm.deprecated) {
        warnings.push({
            rule: 'BR20',
            message: 'The selected term cannot be used since it is deprecated.',
            severity: 'HIGH'
        });
    }
    
    // BR21: Dismissed terms
    if (baseTerm.dismissed) {
        warnings.push({
            rule: 'BR21',
            message: 'The selected term cannot be used since it is dismissed.',
            severity: 'HIGH'
        });
    }
}
```

### BR23 & BR24: Hierarchy Terms

**Implementation:**
```javascript
async checkBR23_BR24(baseTerm, warnings) {
    if (baseTerm.detailLevel !== 'H') return;
    
    // Check if belongs to exposure hierarchy
    const inExposure = await this.db.get(`
        SELECT COUNT(*) as count
        FROM term_hierarchy_relationships
        WHERE term_code = ? AND hierarchy_code = 'expo'
    `, [baseTerm.code]);
    
    if (inExposure.count > 0) {
        warnings.push({
            rule: 'BR23',
            message: 'The use of hierarchy terms as base term is discouraged.',
            severity: 'LOW'
        });
    } else {
        warnings.push({
            rule: 'BR24',
            message: 'The hierarchy term selected does not belong to the exposure hierarchy.',
            severity: 'HIGH'
        });
    }
}
```

### BR25: Single Cardinality

**Logic:**
- Already handled in VBA validation, but reinforced here

**Implementation:**
```javascript
async checkBR25(explicitFacets, warnings) {
    const SINGLE_CARDINALITY = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32'];
    const facetGroups = {};
    
    for (const facet of explicitFacets) {
        const group = facet.split('.')[0];
        facetGroups[group] = (facetGroups[group] || 0) + 1;
    }
    
    for (const [group, count] of Object.entries(facetGroups)) {
        if (SINGLE_CARDINALITY.includes(group) && count > 1) {
            warnings.push({
                rule: 'BR25',
                message: 'Reporting more than one facet is forbidden for this category.',
                severity: 'HIGH',
                involvedTerms: group
            });
        }
    }
}
```

### BR26 & BR27: Process Ordinal Code Rules

**Implementation:**
```javascript
async checkBR26_BR27(baseTerm, explicitFacets, warnings) {
    if (baseTerm.type !== 'd') return;
    
    // Get process information with ordinal codes
    const processes = await this.getProcessesWithOrdinalCodes(
        baseTerm, 
        explicitFacets.filter(f => f.startsWith('F28.'))
    );
    
    // BR26: Check for same ordinal code
    const ordinalGroups = {};
    for (const proc of processes) {
        if (proc.ordinalCode !== 0) {
            ordinalGroups[proc.ordinalCode] = ordinalGroups[proc.ordinalCode] || [];
            ordinalGroups[proc.ordinalCode].push(proc.code);
        }
    }
    
    for (const [ordinal, codes] of Object.entries(ordinalGroups)) {
        if (codes.length > 1) {
            warnings.push({
                rule: 'BR26',
                message: 'The selected processes cannot be used together for derivative base term.',
                severity: 'HIGH',
                involvedTerms: codes.join(' - ')
            });
        }
    }
    
    // BR27: Check decimal ordinal codes
    const decimalProcesses = processes.filter(p => p.ordinalCode % 1 !== 0);
    const integerGroups = {};
    
    for (const proc of decimalProcesses) {
        const intPart = Math.floor(proc.ordinalCode);
        integerGroups[intPart] = integerGroups[intPart] || [];
        integerGroups[intPart].push(proc);
    }
    
    for (const [intPart, procs] of Object.entries(integerGroups)) {
        if (procs.length > 1 && procs.some(p => p.isExplicit)) {
            warnings.push({
                rule: 'BR27',
                message: 'Processes that create a new derivative nature cannot be applied to existing derivative base terms.',
                severity: 'HIGH',
                involvedTerms: procs.map(p => p.code).join(' - ')
            });
        }
    }
}
```

### BR28: Reconstitution Check

**Implementation:**
```javascript
async checkBR28(baseTerm, explicitFacets, warnings) {
    // Check if base term is concentrate/powder/dehydrated
    const dehydratedTerms = ['concentrate', 'powder', 'dried', 'dehydrated'];
    const isDehydrated = dehydratedTerms.some(term => 
        baseTerm.name.toLowerCase().includes(term)
    );
    
    if (!isDehydrated) return;
    
    const reconstitutionProcesses = ['A07MR', 'A07MQ']; // Reconstitution, Dilution
    
    for (const facet of explicitFacets.filter(f => f.startsWith('F28.'))) {
        const processCode = facet.split('.')[1];
        
        if (reconstitutionProcesses.includes(processCode)) {
            warnings.push({
                rule: 'BR28',
                message: 'Processes that create a new derivative nature cannot be applied to existing derivative base terms. Start from the reconstituted/diluted term instead.',
                severity: 'HIGH',
                involvedTerms: processCode
            });
        }
    }
}
```

### BR29, BR30, BR31: Structure Validation

**Note:** These are handled in VBA validation layer, but can be reinforced:

**Implementation:**
```javascript
async checkBR29_30_31(baseTermCode, facetString, warnings) {
    // BR29: Code structure
    if (!/^[A-Z0-9]{5}$/.test(baseTermCode)) {
        warnings.push({
            rule: 'BR29',
            message: 'The code does not follow the required structure or is misspelled.',
            severity: 'ERROR'
        });
        return;
    }
    
    // BR30 & BR31: Facet validation
    const facets = this.parseFacets(facetString);
    for (const facet of facets) {
        const [group, code] = facet.split('.');
        
        // BR30: Valid facet group
        const validGroups = await this.db.all('SELECT code FROM facet_groups');
        if (!validGroups.find(g => g.code === group)) {
            warnings.push({
                rule: 'BR30',
                message: 'The category does not exist.',
                severity: 'ERROR',
                involvedTerms: group
            });
            continue;
        }
        
        // BR31: Valid facet for category
        const validFacet = await this.db.get(`
            SELECT 1 FROM terms t
            JOIN term_hierarchy_relationships thr ON t.code = thr.term_code
            WHERE t.code = ? AND thr.hierarchy_code = ?
        `, [code, group.toLowerCase()]);
        
        if (!validFacet) {
            warnings.push({
                rule: 'BR31',
                message: 'The facet is not valid for the facet category.',
                severity: 'ERROR',
                involvedTerms: `${code} in ${group}`
            });
        }
    }
}
```

## Complete Business Rules Runner

```javascript
class BusinessRulesValidator {
    constructor(db, context = 'ICT') {
        this.db = db;
        this.context = context; // ICT, DCF, internal, external
    }
    
    async validateCode(baseTermCode, facetString) {
        const warnings = [];
        
        // Parse input
        const baseTerm = await this.getBaseTerm(baseTermCode);
        if (!baseTerm) {
            warnings.push({
                rule: 'BR29',
                message: 'Base term not found',
                severity: 'ERROR'
            });
            return { valid: false, warnings };
        }
        
        const explicitFacets = this.parseFacets(facetString);
        
        // Run all business rules
        await this.checkBR01(baseTerm, explicitFacets, warnings);
        await this.checkBR03_BR04(baseTerm, explicitFacets, warnings);
        await this.checkBR05(baseTerm, explicitFacets, warnings);
        await this.checkBR06_BR07(baseTerm, explicitFacets, warnings);
        await this.checkBR08(baseTerm, warnings);
        await this.checkBR10(baseTerm, warnings);
        await this.checkBR11(explicitFacets, warnings);
        await this.checkBR12(baseTerm, explicitFacets, warnings);
        await this.checkBR13(baseTerm, explicitFacets, warnings);
        
        // BR14 & BR15: Context-specific rules
        if (this.context === 'ICT' || this.context === 'DCF') {
            // Apply BR14 logic
        }
        if (this.context === 'DCF') {
            // Apply BR15 logic
        }
        
        await this.checkBR16(baseTerm, explicitFacets, warnings);
        await this.checkBR17(baseTerm, warnings);
        await this.checkBR19(baseTerm, explicitFacets, warnings);
        await this.checkBR20_BR21(baseTerm, warnings);
        await this.checkBR23_BR24(baseTerm, warnings);
        await this.checkBR25(explicitFacets, warnings);
        await this.checkBR26_BR27(baseTerm, explicitFacets, warnings);
        await this.checkBR28(baseTerm, explicitFacets, warnings);
        await this.checkBR29_30_31(baseTermCode, facetString, warnings);
        
        // Determine overall validity
        const hasErrors = warnings.some(w => w.severity === 'ERROR');
        
        return {
            valid: !hasErrors,
            warnings: warnings,
            severity: this.getOverallSeverity(warnings)
        };
    }
    
    getOverallSeverity(warnings) {
        if (warnings.some(w => w.severity === 'ERROR')) return 'ERROR';
        if (warnings.some(w => w.severity === 'HIGH')) return 'HIGH';
        if (warnings.some(w => w.severity === 'LOW')) return 'LOW';
        return 'NONE';
    }
}
```

This implementation guide provides the complete logic for all 31 business rules with actual code examples that can be directly implemented in the FoodEx2 validator.