# Complete FoodEx2 Validation Rules Documentation

This document provides a list of all validation rules implemented in the FoodEx2 validator, combining both VBA structural validation rules and Java business rules. At least, as far as I knew in late june 2025

## Table of Contents
1. VBA Structural Validation Rules
2. Java Business Rules (BR01-BR31)
3. Severity Levels

---

## VBA Structural Validation Rules

These rules perform structural and format validation on FoodEx2 codes.

### VBA-1: Base Term Format Validation
- **Description**: Base term must be exactly 5 alphanumeric characters
- **Check**: Length = 5, characters A-Z0-9 only
- **Error**: "-Base term contains invalid characters or wrong length-"
- **Severity**: ERROR

### VBA-2: Base Term Existence
- **Description**: Base term must exist in the terms database
- **Check**: Database lookup
- **Error**: "-Base term not found-"
- **Severity**: ERROR

### VBA-3: Facet Format Structure
- **Description**: Facets must follow format Fxx.YYYYY
- **Check**: F + 2 digits + dot + 5 alphanumeric characters
- **Errors**: 
  - "-Facet group not correct (Fxx)-"
  - "-Facet term not correct (YYYYY)-"
  - "-Expected '.' after facet group in XXX-"
- **Severity**: ERROR

### VBA-4: Facet Descriptor Existence
- **Description**: All facet descriptor codes must exist in the database
- **Check**: Database lookup for each descriptor
- **Error**: "-Facet descriptor not found-"
- **Severity**: ERROR

### VBA-5: Facet Category Membership
- **Description**: Facet descriptors must belong to their declared category
- **Check**: Verify descriptor exists in correct hierarchy (maps Fxx to hierarchy codes)
- **Error**: "-Facet XXX does not belong to category Fxx-"
- **Severity**: ERROR

### VBA-6: Implicit Facet Removal
- **Description**: Facets already implicit in base term are removed
- **Action**: Automatic removal with warning
- **Warning**: "-Implicit facet/s removed-"
- **Severity**: HIGH

### VBA-7: Single Cardinality Enforcement
- **Description**: Certain facet groups can only appear once
- **Affected Groups**: F01, F02, F03, F07, F11, F22, F24, F26, F30, F32
- **Warning**: "-Multiple instances of Fxx not allowed-"
- **Severity**: HIGH

### VBA-8: Duplicate Facet Detection
- **Description**: No facet code should appear more than once
- **Check**: Compare all facet codes
- **Warning**: "-Duplicate facet Fxx.YYYYY found-"
- **Severity**: HIGH

### VBA-9: Feed Term Highlighting
- **Description**: Special handling for terms containing "feed"
- **Action**: Highlight in results (no warning)
- **Severity**: N/A (informational)

---

## Java Business Rules (BR01-BR31)

These rules implement complex business logic validation for FoodEx2 codes.

### BR01: Source Commodity Raw
- **Description**: For raw commodity terms, F27 facets must be children of implicit F27 or children of the base term
- **Condition**: Base term type = 'r' (raw commodity) with explicit F27 facets
- **Check**: Each F27 must be child of implicit F27 or child of base term in 'racsource' hierarchy
- **Warning**: "BR01> For mixed raw primary commodity terms it is only allowed to add under F27 source-commodities children of the already present implicit facet."
- **Severity**: HIGH

### BR02: Empty Rule
- **Description**: Empty rule - no implementation
- **Status**: EMPTY

### BR03: No F01 in Composite
- **Description**: F01 source facet is not allowed in composite food
- **Condition**: Base term type = 'c' or 's' (composite) with F01 facet
- **Forbidden**: F01 (Source)
- **Warning**: "BR03> The F01 source facet is not allowed in composite food. Choose instead an F04 ingredient facet."
- **Severity**: HIGH

### BR04: No F27 in Composite
- **Description**: F27 source-commodities facet is not allowed in composite food
- **Condition**: Base term type = 'c' or 's' (composite) with F27 facet
- **Forbidden**: F27 (Source-commodities)
- **Warning**: "BR04> The F27 source-commodities facet is not allowed in composite food. Choose instead an F04 ingredient facet."
- **Severity**: HIGH

### BR05: F27 Derivative Restriction
- **Description**: For derivatives, explicit F27 must better specify (be child of) implicit F27
- **Condition**: Base term type = 'd' (derivative) with implicit and explicit F27
- **Check**: Explicit F27 must NOT be child of implicit F27 (triggers warning)
- **Warning**: "BR05> The F27 source-commodities facet which are not better specifing the already present implicit one are not allowed. Start from the generic derivative term instead."
- **Severity**: HIGH

### BR06: F01 Requires F27
- **Description**: F01 source facet in derivatives requires implicit F27 to be present
- **Condition**: Derivative with F01 but no implicit F27
- **Warning**: "BR06> The F01 source facet is only allowed in derivatives with an F27 source-commodities facet implicitly present."
- **Severity**: HIGH

### BR07: F01 Single F27
- **Description**: F01 source facet should only be used with single F27 in derivatives
- **Condition**: Derivative with F01 and multiple F27 (implicit + explicit)
- **Warning**: "BR07> The F01 source facet can only be populated for derivatives having a single F27 source-commodities facet."
- **Severity**: HIGH

### BR08: Reporting Hierarchy
- **Description**: Base term must be reportable (not forbidden in reporting)
- **Check**: Term does not belong to 'report' hierarchy or is dismissed
- **Warning**: "BR08> The use of this term is forbidden in the reporting hierarchy."
- **Severity**: HIGH

### BR09: Empty Rule
- **Description**: Empty rule - no implementation
- **Status**: EMPTY

### BR10: Non-Specific Terms
- **Description**: Non-specific terms as base terms are discouraged
- **Condition**: Term type = 'n' or name contains "other"/"unspecified"
- **Warning**: "BR10> The use of non-specific terms as base term is discouraged."
- **Severity**: LOW

### BR11: Generic Process
- **Description**: Generic process terms under F28 are discouraged
- **Check**: Process term is "Processed" (A0EZH) or its children
- **Warning**: "BR11> The use of generic terms under F28 process facet is discouraged."
- **Severity**: LOW

### BR12: Ingredient Restrictions
- **Description**: F04 ingredient facet restrictions for raw commodities and derivatives
- **Conditions**:
  - Raw commodity (type='r') or derivative (type='d') with F04 facet
  - For derivatives: F04 without F28 process is discouraged
- **Warning**: "BR12> The F04 ingredient facet can only be used as a minor ingredient to derivative or raw primary commodity terms."
- **Severity**: LOW

### BR13: Physical State Creates Derivative
- **Description**: F03 physical state facet creates new derivative for raw commodities
- **Condition**: Raw commodity with F03 or F06 facet without F28 process
- **Warning**: "BR13> The F03 physical state facet reported creates a new derivative nature and therefore cannot be applied to raw primary commodity."
- **Severity**: HIGH

### BR14: Placeholder Rule (ICT/DCF)
- **Description**: Placeholder rule reserved for ICT/DCF context-specific validation
- **Implementation**: Defined but not implemented - no validation logic exists
- **Warning**: "BR14> This br is only applied on ICT and DCF."
- **Severity**: HIGH
- **Status**: NOT IMPLEMENTED

### BR15: Placeholder Rule (DCF)
- **Description**: Placeholder rule reserved for DCF context-specific validation
- **Implementation**: Defined but not implemented - no validation logic exists
- **Warning**: "BR15> This br is only applied on DCF."
- **Severity**: LOW
- **Status**: NOT IMPLEMENTED

### BR16: Process Detail Level
- **Description**: Process facets should be more detailed than implicit processes
- **Check**: Compares ordinal codes - explicit process ordCode should not be less than implicit
- **Warning**: "BR16> Reporting facets less detailed than the implicit facets is discouraged."
- **Severity**: HIGH

### BR17: No Facet Base Terms
- **Description**: Facet terms cannot be used as base terms
- **Condition**: Base term has term_type = 'f' (facet)
- **Warning**: "BR17> Reporting facets as base term is forbidden."
- **Severity**: HIGH

### BR18: Empty Rule
- **Description**: Empty rule - no implementation
- **Status**: EMPTY

### BR19: Forbidden Processes
- **Description**: Processes that create new derivatives cannot be applied to raw commodities
- **Check**: Uses forbidden processes data file (BR_Data.csv) to check process restrictions
- **Warning**: "BR19> Processes that create a new derivative nature cannot be applied to raw commodity base terms. Start from the exsisting derivative base term instead."
- **Severity**: HIGH

### BR20: Deprecated Terms
- **Description**: Deprecated terms cannot be used
- **Check**: Checks both base term and all facet descriptors for deprecated flag
- **Warning**: "BR20> The selected term cannot be used since it is deprecated."
- **Severity**: HIGH

### BR21: Dismissed Terms
- **Description**: Dismissed terms cannot be used
- **Check**: Checks both base term and all facet descriptors for dismissed status
- **Warning**: "BR21> The selected term cannot be used since it is dismissed."
- **Severity**: HIGH

### BR22: Success Message
- **Description**: Shows success message when base term has no high warnings
- **Condition**: Base term successfully added without high-level warnings
- **Warning**: "BR22> Base term successfully added."
- **Severity**: NONE (informational)

### BR23: Hierarchy Terms Discouraged
- **Description**: Hierarchy terms as base terms are discouraged
- **Condition**: Term detail_level = 'H' AND term belongs to exposure hierarchy
- **Warning**: "BR23> The use of hierarchy terms as base term is discouraged."
- **Severity**: LOW

### BR24: Non-Exposure Hierarchy
- **Description**: Hierarchy terms must belong to exposure hierarchy
- **Condition**: Term detail_level = 'H' AND term does NOT belong to 'expo' hierarchy
- **Warning**: "BR24> The hierarchy term selected does not belong to the exposure hierarchy."
- **Severity**: HIGH

### BR25: Single Cardinality
- **Description**: Certain facet categories allow only one facet
- **Groups**: F01, F02, F03, F07, F11, F22, F24, F26, F30, F32
- **Warning**: "BR25> Reporting more than one facet is forbidden for this category."
- **Severity**: HIGH

### BR26: Mutually Exclusive Processes
- **Description**: Processes with same ordinal code cannot be used together on derivatives
- **Condition**: Derivative with multiple processes having same ordinal code
- **Check**: Compares ordinal codes of all processes (implicit and explicit)
- **Warning**: "BR26> The selected processes cannot be used together for derivative base term."
- **Severity**: HIGH

### BR27: Decimal Ordinal Code
- **Description**: Processes with decimal ordinal codes create new derivatives
- **Condition**: Two processes with decimal ordCode and same integer part (at least one explicit)
- **Warning**: "BR27> Processes that create a new derivative nature cannot be applied to exsisting derivative base terms. Start from a different derivative base term instead."
- **Severity**: HIGH

### BR28: Reconstitution Forbidden
- **Description**: Reconstitution process forbidden on concentrated/dehydrated terms
- **Condition**: Process F28.A0DPF applied to terms containing "concentrate", "powder", "dried", or "dehydrated"
- **Warning**: "BR28> Processes that create a new derivative nature cannot be applied to exsisting derivative base terms. Start from the reconstituted/diluted term instead."
- **Severity**: HIGH

### BR29: Invalid Code Structure
- **Description**: Code structure validation (handled in VBA validator)
- **Check**: Validates overall code format and structure
- **Warning**: "BR29> The code does not follow the required structure or is misspelled."
- **Severity**: ERROR

### BR30: Facet Category Existence
- **Description**: Facet category must exist (handled in VBA validator)
- **Check**: Validates facet group ID format (Fxx)
- **Warning**: "BR30> The category does not exist."
- **Severity**: ERROR

### BR31: Facet Category Membership
- **Description**: Facet must belong to its category (handled in VBA validator)
- **Check**: Validates facet descriptor belongs to declared hierarchy
- **Warning**: "BR31> The facet is not valid for the facet category."
- **Severity**: ERROR

---

## Severity Levels

### ERROR
- Code is structurally invalid or violates mandatory rules
- Validation fails
- Examples: Invalid format, non-existent terms, forbidden combinations

### HIGH  
- Serious issues that should be corrected
- Validation passes with warnings
- Examples: Hierarchy terms, cardinality violations, deprecated usage

### LOW
- Discouraged practices
- Validation passes with advisories  
- Examples: Non-specific terms, generic processes, insufficient detail

### NONE
- Informational only
- No impact on validation
- Examples: Feed term highlighting

---

## Summary

This document contains all 9 VBA structural validation rules and 31 business rules (BR01-BR31) implemented in the FoodEx2 validator. The rules ensure:

1. **Structural Integrity**: Proper format for base terms and facets
2. **Data Consistency**: Terms and facets exist in the database
3. **Business Logic**: Complex relationships between term types and facets
4. **Context Awareness**: Different rules apply in different contexts (ICT, DCF)
5. **User Guidance**: Clear warnings help users create valid FoodEx2 codes

The validation process runs in sequence:
1. VBA structural validation (format, existence, cardinality)
2. Business rules validation (type compatibility, hierarchy rules)
3. Result aggregation with appropriate severity levels