# VBA to JavaScript Implementation Mapping

This document provides a detailed mapping of VBA validation logic to JavaScript implementation for the FoodEx2 validator.

## 1. Facet Structure Validation

### VBA Implementation (FacetChecker.bas)
```vba
Function checkCorrectFacet(k As Integer, strFacets As String) As Boolean
    Dim FArr() As String, bFlag As Boolean, strItem As Variant
    FArr = Split(strFacets, "$")
    bFlag = True
    
    For Each strItem In FArr
        Dim GArr() As String
        GArr = Split(strItem, ".")
        
        If UBound(GArr) > 0 Then
            If (GArr(0) Like "*[!.A-Za-z0-9]*") Or (Len(GArr(0)) <> 3) Then
                bFlag = False
                Exit For
            ElseIf (GArr(1) Like "*[!.A-Za-z0-9]*") Or (Len(GArr(1)) <> 5) Then
                Call addWarningMessage(k, "-Facet term not correct (" & GArr(1) & " )-")
                bFlag = False
                Exit For
            End If
        Else
            Call addWarningMessage(k, "-Expected '.' after facet group in " & strItem & "-")
            bFlag = False
            Exit For
        End If
    Next
    
    checkCorrectFacet = bFlag
End Function
```

### JavaScript Implementation
```javascript
function checkCorrectFacet(facets, warnings) {
    const facetArray = facets.split('$');
    let isValid = true;
    
    for (const facet of facetArray) {
        const parts = facet.split('.');
        
        if (parts.length <= 1) {
            warnings.push({
                message: `-Expected '.' after facet group in ${facet}-`,
                severity: 'ERROR'
            });
            isValid = false;
            break;
        }
        
        const [groupId, descriptor] = parts;
        
        // Check facet group format (Fxx - F followed by 2 digits)
        if (!/^F\d{2}$/.test(groupId)) {
            isValid = false;
            break;
        }
        
        // Check descriptor format (5 alphanumeric characters)
        if (!/^[A-Z0-9]{5}$/.test(descriptor)) {
            warnings.push({
                message: `-Facet term not correct (${descriptor})-`,
                severity: 'ERROR'
            });
            isValid = false;
            break;
        }
    }
    
    return isValid;
}
```

## 2. Implicit Facet Detection and Removal

### VBA Implementation
```vba
Function checkFacets(i As Integer)
    intImplicit = 0
    intCounter = 0
    
    For j = 1 To intFacets
        strFacetEntry = Mid(strContext, 1, 10)
        strActualFacet = Mid(strFacetEntry, 2)
        strContext = Mid(strContext, 11)
        
        If InStr(strImplicitFacet, strActualFacet) > 0 Then
            intImplicit = 1
            Call addWarningMessage(i, "-Implicit facet/s removed-")
        Else
            intCounter = intCounter + 1
            stack(intCounter, 1) = strActualFacet
            ' ... store facet details
        End If
    Next j
End Function
```

### JavaScript Implementation
```javascript
function checkAndRemoveImplicitFacets(explicitFacets, implicitFacets, warnings) {
    const cleanedFacets = [];
    let implicitRemoved = false;
    
    for (const facet of explicitFacets) {
        // Extract facet code (remove separator)
        const facetCode = facet.startsWith('#') || facet.startsWith('$') 
            ? facet.substring(1) 
            : facet;
        
        // Check if this facet is implicit
        if (implicitFacets.includes(facetCode)) {
            implicitRemoved = true;
        } else {
            cleanedFacets.push(facetCode);
        }
    }
    
    if (implicitRemoved) {
        warnings.push({
            message: '-Implicit facet/s removed-',
            severity: 'HIGH'
        });
    }
    
    return {
        cleanedFacets,
        implicitRemoved
    };
}
```

## 3. Facet Descriptor Validation

### VBA Implementation
```vba
For k = 1 To intLastDataRow
    If data(k, 1) = stack(intCounter, 3) Then
        stack(intCounter, 5) = data(k, 2)
        Exit For
    Else
        stack(intCounter, 5) = "NOT FOUND"
    End If
Next k

If InStr(stack(intCounter, 5), "NOT FOUND") <> 0 Then 
    Call addWarningMessage(i, "-Facet descriptor not found-")
```

### JavaScript Implementation
```javascript
async function validateFacetDescriptor(facetCode, db, warnings) {
    const descriptor = facetCode.split('.')[1];
    
    const term = await db.get(`
        SELECT code, name 
        FROM terms 
        WHERE code = ?
    `, [descriptor]);
    
    if (!term) {
        warnings.push({
            message: '-Facet descriptor not found-',
            severity: 'ERROR'
        });
        return null;
    }
    
    return term;
}
```

## 4. Single Cardinality Validation

### VBA Implementation
```vba
If intCounter > 1 Then
    For j = 1 To intCounter - 1
        strGroupId = stack(j, 2)
        For l = j + 1 To intCounter
            If stack(l, 2) = strGroupId And InStr("F01 F02 F03 F07 F11 F22 F24 F26 F30 F32", strGroupId) > 0 Then
                Call addWarningMessage(i, "-Multiple instances of " & strGroupId & " not allowed-")
                strGroupId = "Found"
            End If
        Next l
        If strGroupId = "Found" Then Exit For
    Next j
End If
```

### JavaScript Implementation
```javascript
function checkSingleCardinalityFacets(facets, warnings) {
    const SINGLE_CARDINALITY_GROUPS = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32', 'F34'];
    const facetGroups = {};
    
    // Count occurrences of each facet group
    for (const facet of facets) {
        const groupId = facet.split('.')[0];
        facetGroups[groupId] = (facetGroups[groupId] || 0) + 1;
    }
    
    // Check for violations
    for (const [groupId, count] of Object.entries(facetGroups)) {
        if (SINGLE_CARDINALITY_GROUPS.includes(groupId) && count > 1) {
            warnings.push({
                message: `-Multiple instances of ${groupId} not allowed-`,
                severity: 'HIGH'
            });
        }
    }
}
```

## 5. Base Term Validation

### VBA Implementation (BasetermChecker.bas)
```vba
Function checkBaseterm(strBaseterm As String) As Integer
    If strBaseterm Like "*[!.A-Za-z0-9]*" Then
        checkBaseterm = 0
        Exit Function
    Else
        Dim n As Integer
        For n = 1 To intLastDataRow
            If data(n, 1) = strBaseterm Then
                checkBaseterm = n
                Exit Function
            End If
        Next n
        checkBaseterm = 0
        Exit Function
    End If
End Function
```

### JavaScript Implementation
```javascript
async function checkBaseTerm(baseTermCode, db) {
    // Check for invalid characters
    if (!/^[A-Z0-9]+$/.test(baseTermCode)) {
        return {
            valid: false,
            error: 'Base term contains invalid characters'
        };
    }
    
    // Check if term exists in database
    const term = await db.get(`
        SELECT * FROM terms 
        WHERE code = ?
    `, [baseTermCode]);
    
    if (!term) {
        return {
            valid: false,
            error: 'Base term not found in database'
        };
    }
    
    return {
        valid: true,
        term: term
    };
}
```

## 6. Facet Separator Management

### VBA Implementation
```vba
For j = 1 To intCounter
    If j = 1 Then
        strContext = strContext & "#" & stack(j, 1)
    Else
        strContext = strContext & "$" & stack(j, 1)
    End If
Next j
```

### JavaScript Implementation
```javascript
function buildFacetString(facets) {
    return facets.map((facet, index) => {
        const separator = index === 0 ? '#' : '$';
        return separator + facet;
    }).join('');
}

function parseFacetString(facetString) {
    // Handle both # and $ separators
    const facets = facetString.split(/[#$]/).filter(f => f);
    return facets;
}
```

## 7. Complete Validation Flow

### JavaScript Implementation
```javascript
class VBAValidator {
    constructor(db) {
        this.db = db;
    }
    
    async validateFoodEx2Code(baseTermCode, facetString) {
        const warnings = [];
        
        // 1. Validate base term
        const baseTermResult = await this.checkBaseTerm(baseTermCode);
        if (!baseTermResult.valid) {
            warnings.push({
                message: baseTermResult.error,
                severity: 'ERROR'
            });
            return { valid: false, warnings };
        }
        
        // 2. Parse and validate facet structure
        const facets = this.parseFacetString(facetString);
        if (!this.checkCorrectFacet(facets.join('$'), warnings)) {
            return { valid: false, warnings };
        }
        
        // 3. Get implicit facets for the base term
        const implicitFacets = await this.getImplicitFacets(baseTermResult.term);
        
        // 4. Remove implicit facets
        const { cleanedFacets, implicitRemoved } = this.checkAndRemoveImplicitFacets(
            facets, 
            implicitFacets, 
            warnings
        );
        
        // 5. Validate facet descriptors
        for (const facet of cleanedFacets) {
            await this.validateFacetDescriptor(facet, warnings);
        }
        
        // 6. Check single cardinality rules
        this.checkSingleCardinalityFacets(cleanedFacets, warnings);
        
        // 7. Build final code
        const finalCode = baseTermCode + this.buildFacetString(cleanedFacets);
        
        return {
            valid: warnings.filter(w => w.severity === 'ERROR').length === 0,
            warnings,
            originalCode: baseTermCode + facetString,
            cleanedCode: implicitRemoved ? finalCode : null
        };
    }
}
```

## Key Differences and Considerations

1. **Pattern Matching**: VBA's `Like` operator is replaced with JavaScript RegExp
2. **Array Handling**: VBA's 1-based arrays become 0-based in JavaScript
3. **String Functions**: VBA's `Mid`, `InStr` replaced with JavaScript string methods
4. **Database Access**: VBA's direct array access replaced with async database queries
5. **Error Handling**: JavaScript uses try-catch and promises vs VBA's error handling

## Performance Optimizations

1. **Batch Database Queries**: Instead of checking each facet individually, batch queries
2. **Caching**: Cache term lookups to avoid repeated database queries
3. **Early Exit**: Implement early exit strategies for invalid codes
4. **Parallel Processing**: Use Promise.all for independent validations

This mapping provides a foundation for implementing the complete VBA validation logic in JavaScript while maintaining the exact same business rules and warning messages.