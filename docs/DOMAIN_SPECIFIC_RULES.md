# Domain-Specific Mandatory Facet Rules

These rules are organized by monitoring domain and represent mandatory or highly recommended facet requirements for specific regulatory and monitoring programs. They serve as self-enforcing checks to ensure data quality and regulatory compliance.

## VMPR Domain (Veterinary Medicine Products Residues)

### VMPR-STANDARD: Standard VMPR Samples
- **Facets Required**: F01 (Source) AND F02 (Part-nature)
- **Severity**: ERROR (Mandatory)
- **Applies To**: Animal tissue, milk, eggs, honey samples
- **Requirement**: Both facets must always be present for VMPR monitoring
- **Rationale**: Essential for identifying the animal source and specific tissue/product being tested

### VMPR-RPC: RPC Derivatives and Processed Products
- **Facets Required**: F01 (Source)
- **Severity**: ERROR (Mandatory)
- **Applies To**: RPC Derivative base terms or "Processed" products intended for VMPR
- **Requirement**: F01 Source must be explicitly reported by the data provider
- **Special Note**: Cannot rely on implicit facets for processed products in VMPR context
- **Rationale**: Ensures traceability of animal source in processed products

### VMPR-NONFOOD: Non-Food Animal Matrices
- **Facets Required**: F01 (Source) AND F02 (Part-nature)
- **Severity**: ERROR (Mandatory)
- **Applies To**: Base term A0C60 (Non-food animal-related matrices)
- **Requirement**: Both explicit facets must be included
- **Details**:
  - F01: Characterizes the animal species
  - F02: Characterizes the sample tissue/type
- **Rationale**: Essential for characterizing the host animal and the matrix tested

### VMPR-PLAN3: Processed Products Under Plan 3
- **Facets Required**: F33 (Legislative classes)
- **Severity**: ERROR (Mandatory)
- **Applies To**: Processed products under third-country import control (Plan 3)
- **Requirement**: F33 must be reported
- **Special Rule**: Only ONE F33 code is permitted per mixed sample
- **Example**: Mixed pork and beef products should have single F33 code
- **Rationale**: Required for correct classification into VMPR legislative matrix categories

## Food Additives Domain

### ADDITIVES-STANDARD: Food Additives Monitoring
- **Facets Required**: F33 (Legislative category) AND F03 (Physical-state)
- **Severity**: ERROR for F33, HIGH for F03
- **Applies To**: All food additives monitoring
- **Requirements**:
  - F33: MANDATORY - Legislative food category per Regulation (EC) No 1333/2008
  - F03: Highly recommended - Physical state of the additive
- **Rationale**: Crucial for regulatory compliance and subsequent monitoring programs
- **Implementation Note**: F33 is non-negotiable for the additives domain

## Contaminants Domain

### CONTAM-ACRYLAMIDE: Acrylamide Monitoring
- **Facets Required**: F33 (Legislative classes)
- **Severity**: ERROR (Mandatory)
- **Applies To**: Samples analyzed for acrylamide
- **Requirement**: F33 must be reported with relevant legislative class
- **Rationale**: Required for specific monitoring programs related to chemical contaminants
- **Related Rules**: See also F17 (Extent-of-cooking) for heat treatment context

## Implementation Matrix

| Domain | Base Term/Context | F01 | F02 | F03 | F33 | F17 | F19 | F07 | F23 |
|--------|------------------|-----|-----|-----|-----|-----|-----|-----|-----|
| VMPR Standard | Animal products | ✅ | ✅ | - | - | - | - | - | - |
| VMPR RPC/Processed | Derivatives | ✅ | - | - | - | - | - | - | - |
| VMPR Non-food | A0C60 | ✅ | ✅ | - | - | - | - | - | - |
| VMPR Plan 3 | Processed imports | - | - | - | ✅ | - | - | - | - |
| Food Additives | All additives | - | - | ⚠️ | ✅ | - | - | - | - |
| Contaminants (Acrylamide) | Acrylamide samples | - | - | - | ✅ | ⚠️ | - | - | - |
| Contaminants (Packaging) | Bisphenol/Phthalates | - | - | - | - | - | ⚠️ | - | - |
| Fat Expression | Fat weight results | - | - | - | - | - | - | ⚠️ | - |
| Infant Products | Under 12 months | - | - | - | - | - | - | - | ⚠️ |

Legend:
- ✅ = Mandatory (ERROR severity)
- ⚠️ = Highly Recommended/Required (MEDIUM/LOW severity)
- \- = Not specifically required

## Validation Logic Pseudocode

```javascript
function validateDomainSpecificRules(code, context) {
  const warnings = [];

  // VMPR Domain Checks
  if (context.domain === 'VMPR') {
    // Standard VMPR samples
    if (isAnimalProduct(code.baseTerm)) {
      if (!hasFacet(code, 'F01')) {
        warnings.push({
          rule: 'VMPR-STANDARD-F01',
          severity: 'ERROR',
          message: 'F01 Source is mandatory for VMPR animal product samples'
        });
      }
      if (!hasFacet(code, 'F02')) {
        warnings.push({
          rule: 'VMPR-STANDARD-F02',
          severity: 'ERROR',
          message: 'F02 Part-nature is mandatory for VMPR animal product samples'
        });
      }
    }

    // RPC/Processed products
    if (isRPCDerivative(code.baseTerm) || isProcessedProduct(code.baseTerm)) {
      if (!hasExplicitFacet(code, 'F01')) {
        warnings.push({
          rule: 'VMPR-RPC-F01',
          severity: 'ERROR',
          message: 'F01 Source must be explicitly reported for VMPR processed products'
        });
      }
    }

    // Non-food matrices
    if (code.baseTerm === 'A0C60') {
      if (!hasFacet(code, 'F01')) {
        warnings.push({
          rule: 'VMPR-NONFOOD-F01',
          severity: 'ERROR',
          message: 'F01 Source is mandatory for non-food animal matrices (A0C60)'
        });
      }
      if (!hasFacet(code, 'F02')) {
        warnings.push({
          rule: 'VMPR-NONFOOD-F02',
          severity: 'ERROR',
          message: 'F02 Part-nature is mandatory for non-food animal matrices (A0C60)'
        });
      }
    }

    // Plan 3 imports
    if (context.importPlan === 'plan3' && isProcessedProduct(code.baseTerm)) {
      const f33Count = countFacet(code, 'F33');
      if (f33Count === 0) {
        warnings.push({
          rule: 'VMPR-PLAN3-F33',
          severity: 'ERROR',
          message: 'F33 Legislative class is mandatory for Plan 3 processed products'
        });
      } else if (f33Count > 1) {
        warnings.push({
          rule: 'VMPR-PLAN3-F33-SINGLE',
          severity: 'ERROR',
          message: 'Only one F33 code is permitted for mixed samples under Plan 3'
        });
      }
    }
  }

  // Food Additives Domain
  if (context.domain === 'FOOD_ADDITIVES') {
    if (!hasFacet(code, 'F33')) {
      warnings.push({
        rule: 'ADDITIVES-F33',
        severity: 'ERROR',
        message: 'F33 Legislative category is mandatory for food additives (Reg EC 1333/2008)'
      });
    }
    if (!hasFacet(code, 'F03')) {
      warnings.push({
        rule: 'ADDITIVES-F03',
        severity: 'HIGH',
        message: 'F03 Physical-state is highly recommended for food additives'
      });
    }
  }

  // Contaminants Domain
  if (context.domain === 'CONTAMINANTS') {
    if (context.analyte === 'acrylamide') {
      if (!hasFacet(code, 'F33')) {
        warnings.push({
          rule: 'CONTAM-ACRYLAMIDE-F33',
          severity: 'ERROR',
          message: 'F33 Legislative class is mandatory for acrylamide monitoring'
        });
      }
    }
  }

  return warnings;
}
```

## API Usage Example

```javascript
POST /api/validate
{
  "code": "A0C60#F02.A0C63",
  "context": {
    "domain": "VMPR",
    "subdomain": "non_food_matrices",
    "analyte": "veterinary_residues"
  }
}

// Response
{
  "valid": false,
  "domainWarnings": [
    {
      "rule": "VMPR-NONFOOD-F01",
      "severity": "ERROR",
      "message": "F01 Source is mandatory for non-food animal matrices (A0C60)",
      "domain": "VMPR"
    }
  ]
}
```

## Compliance Checklist

When implementing these domain-specific rules:

1. ✅ Identify the monitoring domain from context or metadata
2. ✅ Check for mandatory facets based on domain requirements
3. ✅ Validate facet cardinality (e.g., single F33 for Plan 3)
4. ✅ Distinguish between implicit and explicit facets where required
5. ✅ Provide clear, actionable error messages
6. ✅ Consider regulatory references in error messages
7. ✅ Allow configuration to enable/disable domain checking
8. ✅ Support batch validation with domain context
9. ✅ Include domain violations in export reports
10. ✅ Track compliance rates per domain for reporting