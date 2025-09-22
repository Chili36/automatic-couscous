# Context-Specific Validation Rules

These validation rules apply only under specific circumstances based on the analysis type, substance being tested, or regulatory requirements. They are not part of the general FoodEx2 validation but should be enforced when the specific context is known.

## F33 Legislative Class Rules

### F33-ACRYLAMIDE: Acrylamide Analysis
- **Severity**: ERROR (Hard/HIGH Risk)
- **Context**: Samples analyzed for acrylamide
- **Requirement**: MANDATORY - The explicit F33 Legislative classes facet must be reported to describe the relevant legislative class
- **Implementation Note**: Should be enforced when analysis_type = "acrylamide"

### F33-ADDITIVES: Food Additives
- **Severity**: ERROR (Hard/HIGH Risk)
- **Context**: Food additives reporting
- **Requirement**: MANDATORY - F33 facet is required to describe the legislative food category according to Regulation (EC) 1333/2008
- **Implementation Note**: Should be enforced when substance_category = "food_additives"
- **Additional**: If not implicitly assigned, it is highly recommended to add it

### F33-VMPR: VMPR Processed Products
- **Severity**: ERROR (Hard/HIGH Risk)
- **Context**: Processed products under national risk-based control plan for third-country import (Plan 3)
- **Requirement**: REQUIRED - F33 Legislative classes facet is required
- **Special Note**: Only one F33 code should be reported for mixed samples (e.g., mix pork and beef)
- **Implementation Note**: Should be enforced when import_plan = "plan3" and product_type = "processed"

### F33-FLAVOURINGS: Flavourings
- **Severity**: LOW (Soft Rule)
- **Context**: Flavourings reporting
- **Requirement**: RECOMMENDED - Report the legislative class facet code (F33) for flavourings
- **Implementation Note**: Should trigger warning when substance_category = "flavourings" and F33 is missing

## Target Consumer Rules

### F23-INFANTS: Infant Products
- **Severity**: LOW (Soft Rule)
- **Context**: Products formulated for infants (under 12 months)
- **Requirement**: RECOMMENDED - If not implicitly assigned, the F23 Target-consumer facet should be explicitly added
- **Implementation Note**: Should trigger warning when product targets infants and F23 is missing

## Non-Food Animal Matrices Rules

### F01-NONFOOD: Source for Non-Food Animal Matrices
- **Severity**: ERROR (Hard/HIGH Risk)
- **Context**: When using base term A0C60 ('Non-food animal-related matrices')
- **Requirement**: MANDATORY - An explicit F01 Source facet code must be included to characterize the source animal species
- **Implementation Note**: Enforce when base_term = "A0C60" and F01 is missing

### F02-NONFOOD: Part Nature for Non-Food Animal Matrices
- **Severity**: ERROR (Hard/HIGH Risk)
- **Context**: When using base term A0C60 ('Non-food animal-related matrices')
- **Requirement**: MANDATORY - An explicit F02 Part nature facet must be included to characterize the sample
- **Implementation Note**: Enforce when base_term = "A0C60" and F02 is missing

## Heat Treatment and Processing Rules

### F17-COOKING: Extent of Cooking
- **Severity**: MEDIUM (Soft Rule)
- **Context**: Reporting heat treatment for substances like furans and acrylamide
- **Requirement**: REQUIRED - Needed for reporting heat treatment applied to food
- **Implementation Note**: Should trigger warning when analysis_type in ["furans", "acrylamide"] and F17 is missing

## Packaging and Expression Rules

### F19-PACKAGING: Packaging Material for Contaminants
- **Severity**: MEDIUM (Soft Rule)
- **Context**: Analysis of certain contaminants (e.g., bisphenol, plasticizing agents like phthalates)
- **Requirement**: CRUCIAL - If missing, a warning should prompt its addition
- **Implementation Note**: Should trigger warning when substance in ["bisphenol", "phthalates"] and F19 is missing

### F07-FAT: Fat Content
- **Severity**: LOW (Soft Rule)
- **Context**: When expression of results is in fat weight
- **Requirement**: REQUIRED - Should be reported when results are expressed as fat weight
- **Implementation Note**: Should trigger warning when result_expression = "fat_weight" and F07 is missing

## Implementation Strategy

These rules should be implemented as optional validators that can be activated based on:

1. **Analysis Context**: Pass analysis metadata to enable specific rule sets
2. **Configuration Flags**: Allow enabling/disabling rule groups
3. **API Parameters**: Accept context parameters in validation requests
4. **Progressive Enhancement**: Start with warnings, allow strict mode for enforcement

## Example API Usage

```javascript
// Example validation request with context
POST /api/validate
{
  "code": "A0C60#F02.A0C63",
  "context": {
    "analysis_type": "contaminants",
    "substance": "bisphenol",
    "base_term_context": "non_food_animal"
  }
}

// Response would include context-specific warnings
{
  "valid": false,
  "warnings": [
    {
      "rule": "F01-NONFOOD",
      "severity": "ERROR",
      "message": "F01 Source facet is mandatory for non-food animal-related matrices (A0C60)"
    },
    {
      "rule": "F19-PACKAGING",
      "severity": "MEDIUM",
      "message": "F19 Packaging material facet is crucial for bisphenol analysis"
    }
  ]
}
```

## Future Considerations

1. **Database Schema**: Add context_rules table to store these conditions
2. **Rule Engine**: Implement a context-aware rule evaluation system
3. **Configuration UI**: Allow users to specify analysis context in web interface
4. **Batch Processing**: Support context specification for batch validations
5. **Reporting**: Include context-specific rule compliance in export reports