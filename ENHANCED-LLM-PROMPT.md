# Enhanced FoodEx2 Code Generation Prompt with Business Rules

## Objective
The user will enter a food/feed term in any European language. Our task is to identify the most appropriate FoodEx2 code from the list below and construct the complete FoodEx2 code including any necessary facets, ensuring compliance with all business rules.

The list is a result of a vector search based on the user's query. It might contain multiple matches at different levels of the food hierarchy.

## Task
Given the search term [HERE WE ENTER THE SEARCHTERM], identify the most appropriate FoodEx2 food matrix match from the list below and construct the complete FoodEx2 code that passes all validation rules.

## Critical FoodEx2 Concepts

### 1. Base Term vs Facets
- **Base Term**: The core food item (e.g., "Apple")
- **Implicit Facets**: Properties automatically inherited from the base term
- **Explicit Facets**: Additional descriptors that must be actively added
- The same food can be expressed at different hierarchy levels with varying implicit facets

### 2. Hierarchy Levels (MUST understand for correct matching)
FoodEx2 uses a hierarchical system where specificity increases down the tree:
- **Level 1**: Broad categories (e.g., "Fruit")
- **Level 2**: Food groups (e.g., "Pome fruits")
- **Level 3**: Specific foods (e.g., "Apples")
- **Level 4+**: Varieties or specific types (e.g., "Granny Smith apples")

### 3. Matching Strategy by User Intent
Analyze what the user is looking for:

#### A. Species/Variety Searches
If searching for a specific variety (e.g., "Granny Smith"):
- Prefer the MOST SPECIFIC code that names that variety
- Look for exact variety matches in full_name or scope_note

#### B. General Food Searches
If searching for a general food (e.g., "apple"):
- Prefer Level 3 codes (specific but not overly detailed)
- Avoid overly broad (Level 1-2) unless specifically requested
- Avoid overly specific (Level 4+) unless user indicates variety

#### C. Processed Food Searches
Consider processing in hierarchy:
- Raw forms are usually at Level 3
- Processed forms may be at Level 4+ or have specific facets
- Look for existing processed food codes before constructing from raw + facets

### 4. Critical Decision Factors

1. **Implicit vs Explicit Facets**:
   - Higher-level codes require MORE explicit facets to be fully described
   - Lower-level codes have more implicit properties built-in
   - Consider which approach gives the most accurate representation

2. **Refinement of Implicitly Processed Terms**:
   - When a pre-defined base term includes an implicit processing step (e.g., 'dried', 'cooked'): Prioritize using this specific term.
   - If further clarity is needed about the original, unprocessed raw material (e.g., for specific regulatory interpretations or detailed data analysis): Consider adding the **F27 (Source commodities)** facet to link back to the primary, unprocessed FoodEx2 code of the originating food. This helps to provide a complete picture of the food's journey from raw to processed state.

3. **Monitoring Flags** (for regulatory compliance):
   - pestFlag: Relevant for pesticide monitoring
   - vetdrugFlag: Relevant for veterinary drug monitoring
   - biomoFlag: Relevant for biological monitoring
   - reportFlag: Required for reporting
   - feedFlag: Applicable to animal feed

4. **Scope Notes**:
   - ALWAYS read scope notes carefully
   - They often contain critical inclusion/exclusion criteria
   - May indicate when to use or avoid a code

### 5. Common Pitfalls to Avoid
- Don't select a broad category when a specific food is available
- Don't select a variety-specific code for general queries
- Consider regional naming differences in scope notes
- Check if processing state affects code selection

### 6. FoodEx2 Coding Rules
1. **Use existing specific terms when available** (don't construct if term exists)
2. **Check termType** - prefer specific terms (r,f,d,s) over general (c,g)
3. **Respect implicit facets** - many terms already include processing
4. **Only construct faceted codes for combinations without dedicated terms**
5. **Example**: Use "Apple juice" (A03XX) NOT "Apples#F28.juicing"

## 7. CRITICAL BUSINESS RULES FOR FACET VALIDATION

### Term Type Restrictions (MUST FOLLOW)
Based on the selected base term's termType, certain facets are FORBIDDEN:

#### Raw Commodities (termType = 'r')
- **ALLOWED**: F27 (if child of term), F28 (check forbidden processes)
- **FORBIDDEN**: 
  - F01 (source) - causes BR03 error
  - F03 (physical state) - would create derivative (BR13)
  - F04 (ingredients) - causes BR12 error
- **Special**: Some processes forbidden for specific raw terms (BR19)

#### Derivatives (termType = 'd')
- **ALLOWED**: F01 (with restrictions), F27, F28, F03
- **RESTRICTED**:
  - F01 only if single F27 present (BR06, BR07)
  - F27 must be more specific than implicit (BR05)
  - F04 causes BR12 warning
- **Process Rules**: Check ordinal codes (BR16)

#### Composites (termType = 'c' or 's')
- **ALLOWED**: F04 (ingredients), F28 (processes)
- **FORBIDDEN**:
  - F01 (source) - causes BR03 error
  - F27 (source commodities) - causes BR04 error

#### Hierarchies/Groups (termType = 'h' or 'g')
- **WARNING**: Should not be used as base terms (BR23, BR24)
- Use more specific terms instead

### Process Facet Rules (F28)
1. **Mutual Exclusivity by Ordinal Code**:
   - Processes with same ordinal code conflict (BR26)
   - Example: Can't have both "baking" and "boiling" (both ordinal 1.x)
   
2. **Process Hierarchy**:
   - Can't add less detailed process than implicit (BR16)
   - Check ordinal codes: explicit must be ≥ implicit

3. **Common Ordinal Groups**:
   ```
   1.x = Heating methods (baking, boiling, frying)
   2.x = Preservation (canning, freezing)
   3.x = Physical treatments (cutting, grinding)
   0 = Non-exclusive processes
   ```

### Single Cardinality Facets (only ONE allowed)
These facets allow only one value (BR25):
- F03 (Physical state)
- F11 (Alcohol content)
- F17 (Extent of cooking)
- F20 (Part consumed)
- F22 (Production place)
- F23 (Target consumer)
- F24 (Intended use)
- F26 (Generic term)

### Validation Checklist Before Adding Facets
1. **Check base term type** → Determine allowed facets
2. **For F01**: Ensure derivative has single F27
3. **For F03**: Only on derivatives, not raw
4. **For F04**: Not on raw/derivatives (warning)
5. **For F27**: Must be child of implicit or base
6. **For F28**: Check ordinal code conflicts

### Common Invalid Combinations
❌ Raw commodity + F01: `A000V#F01.A0F6E` (BR03)
❌ Raw commodity + F03: `A000V#F03.A0F6F` (BR13)
❌ Composite + F27: `A00BZ#F27.A000V` (BR04)
❌ Multiple same ordinal: `A002C#F28.A07JN$F28.A07JP` (BR26)
❌ Non-child F27: `A000V#F27.A0B9Z` (BR01)

### 8. MTX Facet Construction

#### Key Concepts
- **Base foods**: Main items (e.g., A01DJ "Apples")
- **Process terms**: Marked with isProcessTerm=true (e.g., A07KQ "Freezing")
- **Facet types**: F28=Process (including physical treatments), F03=Physical state, F04=Characterizing ingredient, F27=Source-commodities, F01=Source, F02=Part consumed/analysed

#### FoodEx2 Code Construction Pattern
When explicit facets are needed, construct the complete code:
- Pattern: {base_code}#{facet_type}.{facet_code}${facet_type2}.{facet_code2}
- Example: A01DJ + freezing + dicing → A01DJ#F28.A07KQ$F28.A07KX
- Note: Multiple facets are separated by $

#### Common Process Mappings
- Freezing → F28.A07KQ
- Drying → F28.A07KG
- Canning → F28.A0BYP
- Dicing → F28.A07KX
- Slicing → F28.A07KV

#### Common Ingredient Facets
- Characterizing ingredient → F04.{ingredient_code}
- Base ingredient reference → F27.{base_code}

#### Rules
- F27 typically references the base food code
- Multiple processes possible (e.g., frozen + diced)
- Process terms have facetType in metadata
- Only combine if user query implies combination

## List of Food Matrix Codes
[Here we enter the results from the vector database]

## Output Format
Provide a detailed analysis with your selection, reasoning, and the COMPLETE constructed FoodEx2 code.

```json
{
  "selectedCode": "...",
  "selectedName": "...",
  "selectedTermType": "... (CRITICAL: r/d/c/s/h/g - determines allowed facets)",
  "constructedCode": "... (REQUIRED: The complete FoodEx2 code. If no facets needed, same as selectedCode. If facets needed, construct the full code using pattern base#facet1.code1$facet2.code2)",
  "hierarchyLevel": "...",
  "reasoning": "Detailed explanation including: why this level was chosen, what implicit facets are included, whether explicit facets would be needed, and how it matches the user's intent",
  "implicitFacets": "Summary of what properties are already included",
  "suggestedExplicitFacets": "Any facets that should be added for complete description",
  "validationCheck": {
    "termTypeAllowsFacets": true/false,
    "facetRestrictions": ["List any restrictions based on term type"],
    "potentialWarnings": ["List any business rule warnings that might occur"]
  },
  "alternativeCodes": [
    {
      "code": "...",
      "name": "...",
      "termType": "...",
      "reason": "Why this could also work"
    }
  ],
  "confidence": 1-5,
  "regulatoryNotes": "Mention relevant monitoring flags if applicable"
}
```

### IMPORTANT: Constructed Code Examples with Validation
✅ VALID Examples:
- Raw commodity + allowed process: "A000V#F28.A07KQ" (Corn + Freezing)
- Derivative + source: "A002C#F01.A0F6E$F27.A000V" (Cereal bran from cow, from corn)
- Composite + ingredient: "A00BZ#F04.A01DJ" (Fruit pie with apples)

❌ INVALID Examples (DO NOT GENERATE):
- Raw + physical state: "A000V#F03.A0F6F" (Would trigger BR13)
- Composite + source commodity: "A00BZ#F27.A000V" (Would trigger BR04)
- Raw + ingredient: "A000V#F04.A01DJ" (Would trigger BR12)

### Pre-Generation Validation Steps:
1. Identify base term type from search results
2. List allowed facet categories for that type
3. Check each intended facet against restrictions
4. Verify process ordinal codes don't conflict
5. Ensure single-cardinality facets aren't duplicated

### Confidence Scale:
- 5: Perfect match with valid facets
- 4: Very good match with minor validation considerations
- 3: Good match but some facet restrictions apply
- 2: Partial match with significant validation constraints
- 1: Best available but validation issues likely

### Business Rule Quick Reference:
- BR01: F27 child validation
- BR03: No F01 on composites
- BR04: No F27 on composites
- BR12: F04 on raw/derivative warning
- BR13: F03 creates derivatives
- BR16: Process detail level
- BR25: Single cardinality
- BR26: Process mutual exclusivity