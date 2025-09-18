# FoodEx2 Validation Rules - Complete Documentation

This document provides a comprehensive explanation of all validation rules implemented in the FoodEx2 ICT (Interpreting and Checking Tool). The rules are extracted from both VBA and Java implementations.

## Overview

The FoodEx2 validation system consists of two main types of rules:
1. **VBA-side validation rules**: Structural and format validation implemented in VBA
2. **Java business rules (BR01-BR31)**: Complex business logic validation

## VBA-Side Validation Rules

### 1. Facet Structure Validation

**Rule**: Facets must follow the format `Fxx.YYYYY` where:
- `Fxx` is the facet group ID (F followed by 2 digits)
- `.` is a mandatory separator
- `YYYYY` is the 5-character facet descriptor code

**Implementation Details** (from FacetChecker.bas):
```vba
' Check if facet group has symbols
If (GArr(0) Like "*[!.A-Za-z0-9]*") Or (Len(GArr(0)) <> 3) Then
    bFlag = False
' Check if facet term has symbols  
ElseIf (GArr(1) Like "*[!.A-Za-z0-9]*") Or (Len(GArr(1)) <> 5) Then
    Call addWarningMessage(k, "-Facet term not correct (" & GArr(1) & " )-")
```

**Warning**: "-Facet term not correct (XXXXX)-" or "-Expected '.' after facet group in XXX-"

### 2. Implicit Facet Handling

**Rule**: Implicit facets inherited from the base term should be removed from the explicit facet list with a warning.

**Implementation Details**:
- The system identifies facets that are already implicit in the base term
- These are removed from the final code
- Original code is preserved in a separate column
- Warning is generated: "-Implicit facet/s removed-"

### 3. Facet Descriptor Validation

**Rule**: Each facet descriptor code must exist in the terms database.

**Implementation Details**:
```vba
If data(k, 1) = stack(intCounter, 3) Then
    stack(intCounter, 5) = data(k, 2)  ' Save term name
Else
    stack(intCounter, 5) = "NOT FOUND"
End If
```

**Warning**: "-Facet descriptor not found-"

### 4. Single Cardinality Facet Groups

**Rule**: Certain facet groups (F01, F02, F03, F07, F11, F22, F24, F26, F30, F32) can only have one instance.

**Implementation Details**:
```vba
If stack(l, 2) = strGroupId And InStr("F01 F02 F03 F07 F11 F22 F24 F26 F30 F32", strGroupId) > 0 Then
    Call addWarningMessage(i, "-Multiple instances of " & strGroupId & " not allowed-")
```

**Warning**: "-Multiple instances of Fxx not allowed-"

### 5. Base Term Validation

**Rule**: Base term codes must:
- Contain only alphanumeric characters (no special symbols)
- Exist in the terms database

**Implementation Details** (from BasetermChecker.bas):
```vba
If strBaseterm Like "*[!.A-Za-z0-9]*" Then
    checkBaseterm = 0  ' Invalid characters
```

### 6. Facet Separator Rules

**Rule**: 
- First facet is preceded by `#`
- Subsequent facets are preceded by `$`

**Implementation Details**:
```vba
If j = 1 Then
    strContext = strContext & "#" & stack(j, 1)
Else
    strContext = strContext & "$" & stack(j, 1)
End If
```

## Java Business Rules (BR01-BR31)

### BR01: Source Commodity Validation for Raw Terms
**Condition**: For raw commodity terms with implicit F27 facets
**Rule**: Explicit F27 facets must be children of implicit F27 facets or children of the base term
**Severity**: HIGH
**Message**: "For mixed raw primary commodity terms it is only allowed to add under F27 source-commodities children of the already present implicit facet."

### BR02: Empty Rule
**Status**: Not implemented

### BR03: No F01 Source in Composite Foods
**Condition**: Base term is composite (type 'c' or 's')
**Rule**: F01 (source) facets are forbidden
**Severity**: HIGH
**Message**: "The F01 source facet is not allowed in composite food. Choose instead an F04 ingredient facet."

### BR04: No F27 Source-Commodities in Composite Foods
**Condition**: Base term is composite (type 'c' or 's')
**Rule**: F27 (source-commodities) facets are forbidden
**Severity**: HIGH
**Message**: "The F27 source-commodities facet is not allowed in composite food. Choose instead an F04 ingredient facet."

### BR05: F27 Restrictions for Derivatives
**Condition**: Base term is derivative (type 'd')
**Rule**: Explicit F27 facets must be more specific than implicit F27 facets
**Severity**: HIGH
**Message**: "The F27 source-commodities facet which are not better specifing the already present implicit one are not allowed. Start from the generic derivative term instead."

### BR06: F01 Source Requires F27 in Derivatives
**Condition**: Base term is derivative with F01 facet
**Rule**: Must have at least one F27 facet (implicit or explicit)
**Severity**: HIGH
**Message**: "The F01 source facet is only allowed in derivatives with an F27 source-commodities facet implicitly present."

### BR07: F01 Source for Single F27 Only
**Condition**: Base term is derivative with F01 facet
**Rule**: Can only have one F27 facet total (implicit + explicit)
**Severity**: HIGH
**Message**: "The F01 source facet can only be populated for derivatives having a single F27 source-commodities facet."

### BR08: Non-Reportable Terms Check
**Condition**: Term is not dismissed
**Rule**: Term must belong to reporting hierarchy
**Severity**: HIGH
**Message**: "The use of this term is forbidden in the reporting hierarchy."

### BR09: Empty Rule
**Status**: Not implemented

### BR10: Non-Specific Terms Warning
**Condition**: Non-specific term selected as base term
**Rule**: Discouraged but allowed
**Severity**: LOW
**Message**: "The use of non-specific terms as base term is discouraged."

### BR11: Generic Process Terms Warning
**Condition**: F28 facet is "Processed" (A07XS) or its children
**Rule**: Generic process terms are discouraged
**Severity**: LOW
**Message**: "The use of generic terms under F28 process facet is discouraged."

### BR12: Ingredient Facet Restrictions
**Condition**: F04 (ingredient) facet used
**Rule**: Can only be used as minor ingredient for derivatives or raw commodities
**Severity**: LOW
**Message**: "The F04 ingredient facet can only be used as a minor ingredient to derivative or raw primary commodity terms."

### BR13: Physical State Creates Derivatives
**Condition**: F03 (physical state) facet added to raw commodity
**Rule**: Physical state facets create derivatives, forbidden on raw commodities
**Severity**: HIGH
**Message**: "The F03 physical state facet reported creates a new derivative nature and therefore cannot be applied to raw primary commodity."

### BR14: ICT and DCF Only Rule
**Context**: Applied only in ICT and DCF contexts
**Severity**: HIGH

### BR15: DCF Only Rule
**Context**: Applied only in DCF context
**Severity**: LOW

### BR16: Process Facet Detail Level
**Condition**: Derivative with process facet
**Rule**: Process facet ordinal code must be >= implicit process ordinal code
**Severity**: HIGH
**Message**: "Reporting facets less detailed than the implicit facets is discouraged."

### BR17: Facets as Base Terms
**Condition**: Facet term used as base term
**Rule**: Forbidden
**Severity**: HIGH
**Message**: "Reporting facets as base term is forbidden."

### BR18: Empty Rule
**Status**: Not implemented

### BR19: Forbidden Processes on Raw Commodities
**Condition**: Raw commodity with certain processes
**Rule**: Processes that create derivatives cannot be applied to raw commodities
**Severity**: HIGH
**Message**: "Processes that create a new derivative nature cannot be applied to raw commodity base terms. Start from the exsisting derivative base term instead."

**Forbidden Processes by Category** (from BR_Data.csv):
- Cereal grains: Flaking, Flattening, Puffing, Grain milling, Grinding
- Garden vegetables: Juicing, Concentration, Marinating, Pickling, Fermentation, etc.
- Legumes: Drying processes, Canning
- Fruits: Juicing, Concentration, Preserving with sugars

### BR20: Deprecated Terms
**Condition**: Term is marked as deprecated
**Rule**: Cannot be used
**Severity**: HIGH
**Message**: "The selected term cannot be used since it is deprecated."

### BR21: Dismissed Terms
**Condition**: Term is marked as dismissed
**Rule**: Cannot be used
**Severity**: HIGH
**Message**: "The selected term cannot be used since it is dismissed."

### BR22: Non-Hierarchy Base Term Success
**Condition**: Non-hierarchy term as base term (no other high warnings)
**Rule**: Informational success message
**Severity**: NONE
**Message**: "Base term successfully added."

### BR23: Hierarchy Terms as Base Terms
**Condition**: Hierarchy term used as base term
**Rule**: Discouraged but allowed
**Severity**: LOW
**Message**: "The use of hierarchy terms as base term is discouraged."

### BR24: Hierarchy Must Belong to Exposure
**Condition**: Hierarchy term not in exposure hierarchy
**Rule**: Forbidden
**Severity**: HIGH
**Message**: "The hierarchy term selected does not belong to the exposure hierarchy."

### BR25: Single Cardinality Facet Categories
**Condition**: Multiple facets in single-cardinality category
**Rule**: Only one facet allowed per category
**Severity**: HIGH
**Message**: "Reporting more than one facet is forbidden for this category."

### BR26: Mutually Exclusive Processes
**Condition**: Multiple processes with same ordinal code for derivatives
**Rule**: Cannot be used together
**Severity**: HIGH
**Message**: "The selected processes cannot be used together for derivative base term."

### BR27: Process Creates New Derivative
**Condition**: Process with decimal ordinal code applied to derivative
**Rule**: Cannot apply processes that create new derivatives to existing derivatives
**Severity**: HIGH
**Message**: "Processes that create a new derivative nature cannot be applied to exsisting derivative base terms. Start from a different derivative base term instead."

### BR28: Reconstitution on Dehydrated Terms
**Condition**: Reconstitution process on concentrate/powder/dehydrated terms
**Rule**: Start from reconstituted term instead
**Severity**: HIGH
**Message**: "Processes that create a new derivative nature cannot be applied to exsisting derivative base terms. Start from the reconstituted/diluted term instead."

### BR29: Code Structure Validation
**Condition**: Invalid code structure or misspelled
**Rule**: Must follow required structure
**Severity**: ERROR
**Message**: "The code does not follow the required structure or is misspelled."

### BR30: Invalid Facet Category
**Condition**: Facet group ID doesn't exist
**Rule**: Category must exist
**Severity**: ERROR
**Message**: "The category does not exist."

### BR31: Invalid Facet for Category
**Condition**: Facet doesn't belong to facet category hierarchy
**Rule**: Facet must be valid for category
**Severity**: ERROR
**Message**: "The facet is not valid for the facet category."

## Warning Severity Levels

1. **NONE**: Informational messages
2. **LOW**: Warnings that indicate discouraged practices
3. **HIGH**: Serious warnings that indicate likely errors
4. **ERROR**: Critical errors that prevent valid code generation

## Context-Dependent Validation

Some rules apply only in specific contexts:
- **ICT Context**: Rules BR14 and others
- **DCF Context**: Rules BR14, BR15
- **Internal Users**: Different validation thresholds
- **External Users**: Standard validation

## Implementation Notes

1. The VBA validation runs first, handling structural validation
2. Java business rules are executed via command-line interface
3. Warning messages are aggregated and displayed with appropriate severity
4. The system maintains both original and cleaned codes when modifications occur
5. Process ordinal codes determine derivative creation rules

This documentation serves as the authoritative reference for implementing these validation rules in any language or system.