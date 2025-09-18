# FoodEx2 Validation Rules Summary

## Overview

The FoodEx2 validation system implements 31 business rules plus additional VBA-side structural validations. This document summarizes the complete validation logic extracted from the ICT (Interpreting and Checking Tool).

## Validation Layers

### 1. VBA Structural Validation (First Layer)
- **Facet Format**: `Fxx.YYYYY` structure enforcement
- **Character Validation**: Only alphanumeric characters allowed
- **Separator Rules**: First facet uses `#`, subsequent use `$`
- **Implicit Facet Removal**: Automatic removal with warning
- **Descriptor Existence**: All facet codes must exist in database
- **Single Cardinality**: Certain facet groups allow only one instance

### 2. Java Business Rules (Second Layer)
- **31 Business Rules (BR01-BR31)**: Complex validation logic
- **Context-Aware**: Different rules for ICT, DCF, internal/external users
- **Severity Levels**: ERROR, HIGH, LOW, NONE
- **Term Type Specific**: Rules vary by term type (raw, derivative, composite)

## Quick Reference Table

| Rule | Description | Severity | Applies To |
|------|-------------|----------|------------|
| VBA-1 | Facet format validation | ERROR | All |
| VBA-2 | Implicit facet removal | HIGH | All |
| VBA-3 | Descriptor not found | ERROR | All |
| VBA-4 | Multiple single-cardinality facets | HIGH | All |
| BR01 | F27 child validation for raw terms | HIGH | Raw (r) |
| BR03 | No F01 in composites | HIGH | Composite (c,s) |
| BR04 | No F27 in composites | HIGH | Composite (c,s) |
| BR05 | F27 specificity for derivatives | HIGH | Derivative (d) |
| BR06 | F01 requires F27 in derivatives | HIGH | Derivative (d) |
| BR07 | F01 with single F27 only | HIGH | Derivative (d) |
| BR08 | Reporting hierarchy check | HIGH | All |
| BR10 | Non-specific terms discouraged | LOW | All |
| BR11 | Generic process terms warning | LOW | All |
| BR12 | F04 ingredient restrictions | LOW | Raw/Derivative |
| BR13 | Physical state creates derivatives | HIGH | Raw (r) |
| BR14 | ICT/DCF specific rule | HIGH | Context |
| BR15 | DCF only rule | LOW | Context |
| BR16 | Process detail level check | HIGH | All |
| BR17 | No facets as base terms | HIGH | All |
| BR19 | Forbidden processes on raw | HIGH | Raw (r) |
| BR20 | No deprecated terms | HIGH | All |
| BR21 | No dismissed terms | HIGH | All |
| BR22 | Success message | NONE | All |
| BR23 | Hierarchy terms discouraged | LOW | Hierarchy |
| BR24 | Non-exposure hierarchy forbidden | HIGH | Hierarchy |
| BR25 | Single cardinality enforcement | HIGH | All |
| BR26 | Mutually exclusive processes | HIGH | Derivative (d) |
| BR27 | Process creates new derivative | HIGH | Derivative (d) |
| BR28 | No reconstitution on dehydrated | HIGH | Specific |
| BR29 | Code structure validation | ERROR | All |
| BR30 | Invalid facet category | ERROR | All |
| BR31 | Invalid facet for category | ERROR | All |

## Key Concepts

### Term Types
- **r**: Raw commodity (unprocessed)
- **d**: Derivative (processed from raw)
- **c**: Composite (aggregated food)
- **s**: Simple composite
- **f**: Facet (cannot be base term)
- **n**: Non-specific

### Important Facet Groups
- **F01**: Source (animal/plant origin)
- **F03**: Physical state
- **F04**: Ingredient
- **F27**: Source commodities
- **F28**: Process

### Single Cardinality Groups
F01, F02, F03, F07, F11, F22, F24, F26, F30, F32

## Implementation Priority

1. **Critical (Must Have)**:
   - VBA structural validations
   - BR29, BR30, BR31 (structure errors)
   - BR20, BR21 (deprecated/dismissed)
   - BR03, BR04 (composite restrictions)
   - BR17 (facet as base term)

2. **High Priority**:
   - BR01, BR05, BR06, BR07 (source rules)
   - BR13, BR19 (process restrictions)
   - BR25 (cardinality)
   - BR08 (reporting hierarchy)

3. **Medium Priority**:
   - BR16 (detail level)
   - BR26, BR27, BR28 (process interactions)
   - BR23, BR24 (hierarchy warnings)

4. **Low Priority**:
   - BR10, BR11, BR12 (warnings only)
   - BR14, BR15 (context-specific)
   - BR22 (success message)

## Data Dependencies

### Required Database Tables
- `terms`: Base terms and facets
- `term_hierarchy_relationships`: Hierarchy memberships
- `forbidden_processes`: Process restrictions (BR_Data.csv)
- `facet_groups`: Valid facet categories
- `attributes`: Term attributes (implicit facets, etc.)

### Required Files
- `BR_Data.csv`: Forbidden process mappings
- `warningMessages.txt`: Warning text and severity
- `warningColors.txt`: UI color mappings

## Testing Approach

1. **Unit Tests**: Each rule individually
2. **Integration Tests**: Rule interactions
3. **Regression Tests**: Compare with ICT output
4. **Edge Cases**: Boundary conditions
5. **Performance Tests**: Large batch validation

## Notes for Implementers

1. **Order Matters**: VBA validation should run before business rules
2. **Caching**: Cache database lookups for performance
3. **Batch Processing**: Support bulk validation
4. **Error Recovery**: Continue validation after non-critical errors
5. **Logging**: Track which rules triggered for debugging
6. **Context**: Remember to handle ICT/DCF/internal/external contexts

This summary provides a complete overview of all validation rules needed to replicate the ICT functionality.