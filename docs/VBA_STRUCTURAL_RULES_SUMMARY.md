# VBA Structural Validation Rules Summary

This document summarizes all structural validation rules implemented in the VBA logic of the ICT (Interpreting and Checking Tool).

## 1. Code Structure Rules

### Base Term Format
- **Length**: Exactly 5 characters
- **Characters**: Only alphanumeric (A-Z, 0-9)
- **Existence**: Must exist in the terms database
- **Error**: "-Base term contains invalid characters or wrong length-" or "-Base term not found-"

### Facet Format
- **Structure**: `Fxx.YYYYY`
  - `F` followed by 2 digits (e.g., F01, F28)
  - Mandatory dot separator (.)
  - 5-character alphanumeric descriptor code
- **Separators**: First facet uses `#`, subsequent facets use `$`
- **Example**: `A0B9Z#F28.A07JS$F01.A0F6E`
- **Errors**: 
  - "-Facet group not correct (Fxx)-"
  - "-Facet term not correct (YYYYY)-"
  - "-Expected '.' after facet group in XXX-"

## 2. Validation Rules

### Implicit Facet Removal
- **Rule**: Facets already implicit in the base term are removed
- **Action**: Automatic removal with warning
- **Warning**: "-Implicit facet/s removed-" (HIGH severity)
- **Result**: Both original and cleaned codes are preserved

### Facet Descriptor Validation
- **Rule**: All facet descriptors must exist in the database
- **Check**: Lookup in terms table
- **Error**: "-Facet descriptor not found-" (ERROR severity)

### Facet Category Validation
- **Rule**: Facet descriptors must belong to their declared category
- **Check**: Verify descriptor exists in the correct hierarchy
- **Error**: "-Facet XXX does not belong to category Fxx-" (ERROR severity)

### Single Cardinality Rules
- **Rule**: These facet groups can appear only once:
  - F01 (Source)
  - F02 (Part consumed/analysed)
  - F03 (Physical state)
  - F07 (Gender)
  - F11 (Qualitative info)
  - F22 (Part-nature)
  - F24 (Generation)
  - F26 (Production method)
  - F30 (Dough-Mass)
  - F32 (Risky ingredient)
- **Warning**: "-Multiple instances of Fxx not allowed-" (HIGH severity)

### Duplicate Facet Detection
- **Rule**: No facet code should appear more than once
- **Check**: Compare all facet codes
- **Warning**: "-Duplicate facet Fxx.YYYYY found-" (HIGH severity)

## 3. Special Cases

### Feed Term Highlighting
- **Rule**: Terms containing "feed" in their name get special formatting
- **Action**: Highlight term in results (no warning)

### Empty Facets
- **Rule**: Empty or whitespace-only facets are filtered out
- **Action**: Silent removal (no warning)

## 4. Processing Order

1. **Base term validation** (format and existence)
2. **Facet string parsing** (split by # and $)
3. **Facet structure validation** (Fxx.YYYYY format)
4. **Facet descriptor existence check**
5. **Facet category membership check**
6. **Implicit facet removal**
7. **Single cardinality check**
8. **Duplicate detection**
9. **Final code reconstruction**

## 5. Severity Levels

- **ERROR**: Structural violations that make the code invalid
  - Invalid base term
  - Malformed facets
  - Non-existent descriptors
  - Wrong category membership

- **HIGH**: Issues that should be corrected but don't invalidate the code
  - Implicit facets (automatically removed)
  - Cardinality violations
  - Duplicate facets

## 6. Output

The VBA validator produces:
- **Original Code**: As entered by the user
- **Cleaned Code**: With implicit facets removed (if any)
- **Base Term Info**: Code, name, type, etc.
- **Facet List**: Validated facets with their descriptors
- **Warnings**: All validation messages with severity levels
- **Valid Flag**: Boolean indicating if code passes structural validation