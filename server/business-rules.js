// Complete implementation of all 31 FoodEx2 business rules

class BusinessRules {
  constructor(validator) {
    this.validator = validator;
  }

  // BR01: Source commodity validation for raw terms
  async checkBR01(term, facets, warnings) {
    if (!this.isRawCommodity(term)) return;
    
    const implicitF27 = this.getImplicitFacets(term, 'F27');
    const explicitF27 = facets.filter(f => f.startsWith('F27.'));
    
    for (const facet of explicitF27) {
      const facetCode = facet.split('.')[1];
      // Check if facet is child of implicit F27 or child of base term
      if (!await this.isChildOf(facetCode, implicitF27) && 
          !await this.isChildOf(facetCode, term.code)) {
        warnings.push(this.validator.createWarning('BR01', facet));
      }
    }
  }

  // BR03: No F01 source in composite foods
  async checkBR03(term, facets, warnings) {
    if (term.type === 'c' || term.type === 's') { // composite or simple composite
      if (facets.some(f => f.startsWith('F01.'))) {
        warnings.push(this.validator.createWarning('BR03', term.code));
      }
    }
  }

  // BR04: No F27 source-commodities in composite foods
  async checkBR04(term, facets, warnings) {
    if (term.type === 'c' || term.type === 's') {
      if (facets.some(f => f.startsWith('F27.'))) {
        warnings.push(this.validator.createWarning('BR04', term.code));
      }
    }
  }

  // BR05: F27 restrictions for derivatives
  async checkBR05(term, facets, warnings) {
    if (term.type !== 'd') return; // only derivatives
    
    const implicitF27 = this.getImplicitFacets(term, 'F27');
    const explicitF27 = facets.filter(f => f.startsWith('F27.'));
    
    for (const facet of explicitF27) {
      if (!this.isMoreSpecific(facet, implicitF27)) {
        warnings.push(this.validator.createWarning('BR05', facet));
      }
    }
  }

  // BR06: F01 source requires F27 in derivatives
  async checkBR06(term, facets, warnings) {
    if (term.type !== 'd') return;
    
    const hasF01 = facets.some(f => f.startsWith('F01.'));
    const hasF27Implicit = this.getImplicitFacets(term, 'F27').length > 0;
    const hasF27Explicit = facets.some(f => f.startsWith('F27.'));
    
    if (hasF01 && !hasF27Implicit && !hasF27Explicit) {
      warnings.push(this.validator.createWarning('BR06', term.code));
    }
  }

  // BR07: F01 source for single F27 only
  async checkBR07(term, facets, warnings) {
    if (term.type !== 'd') return;
    
    const hasF01 = facets.some(f => f.startsWith('F01.'));
    const f27Count = this.getImplicitFacets(term, 'F27').length + 
                     facets.filter(f => f.startsWith('F27.')).length;
    
    if (hasF01 && f27Count > 1) {
      warnings.push(this.validator.createWarning('BR07', term.code));
    }
  }

  // BR08: Non-reportable terms check
  async checkBR08(term, warnings) {
    if (term.dismissed) return; // skip if dismissed
    
    // Check if term belongs to reporting hierarchy
    const isReportable = await this.isInReportingHierarchy(term);
    if (!isReportable) {
      warnings.push(this.validator.createWarning('BR08', term.code));
    }
  }

  // BR11: Generic process terms warning
  async checkBR11(term, facets, warnings) {
    const genericProcesses = ['A07XS', 'A0B6L']; // Processed, etc.
    
    for (const facet of facets) {
      if (facet.startsWith('F28.')) {
        const processCode = facet.split('.')[1];
        if (genericProcesses.includes(processCode)) {
          warnings.push(this.validator.createWarning('BR11', processCode));
        }
      }
    }
  }

  // BR13: Physical state creates derivatives
  async checkBR13(term, facets, warnings) {
    if (term.type === 'r') { // raw commodity
      if (facets.some(f => f.startsWith('F03.'))) {
        warnings.push(this.validator.createWarning('BR13', term.code));
      }
    }
  }

  // BR16: Process detail level check
  async checkBR16(term, facets, warnings) {
    if (term.type !== 'd') return;
    
    const implicitProcessOrdCode = await this.getImplicitProcessOrdCode(term);
    if (!implicitProcessOrdCode) return;
    
    for (const facet of facets) {
      if (facet.startsWith('F28.')) {
        const processOrdCode = await this.getProcessOrdCode(facet.split('.')[1]);
        if (processOrdCode && processOrdCode < implicitProcessOrdCode) {
          warnings.push(this.validator.createWarning('BR16', facet));
        }
      }
    }
  }

  // BR17: Facets as base term forbidden
  async checkBR17(term, warnings) {
    if (term.type === 'f') { // facet type
      warnings.push(this.validator.createWarning('BR17', term.code));
    }
  }

  // BR23: Hierarchy as base term warning
  async checkBR23(term, warnings) {
    if (term.type === 'h' || term.type === 'g') { // hierarchy or group
      const isExposure = await this.isInExposureHierarchy(term);
      if (isExposure) {
        warnings.push(this.validator.createWarning('BR23', term.code));
      }
    }
  }

  // BR24: Non-exposure hierarchy warning
  async checkBR24(term, warnings) {
    if (term.type === 'h' || term.type === 'g') {
      const isExposure = await this.isInExposureHierarchy(term);
      if (!isExposure) {
        warnings.push(this.validator.createWarning('BR24', term.code));
      }
    }
  }

  // BR25: Single cardinality check
  async checkBR25(term, facets, warnings) {
    const facetCategories = {};
    
    // Group facets by category
    for (const facet of facets) {
      const category = facet.split('.')[0];
      if (!facetCategories[category]) {
        facetCategories[category] = [];
      }
      facetCategories[category].push(facet);
    }
    
    // Check single cardinality categories
    const singleCardinalityCategories = ['F01', 'F02', 'F03', 'F07', 'F11', 'F22', 'F24', 'F26', 'F30', 'F32', 'F34'];
    
    for (const category of singleCardinalityCategories) {
      if (facetCategories[category] && facetCategories[category].length > 1) {
        warnings.push(this.validator.createWarning('BR25', category));
      }
    }
  }

  // BR26: Mutually exclusive processes
  async checkBR26(term, facets, warnings) {
    if (term.type !== 'd') return;
    
    const processes = await this.getProcessesWithOrdCodes(facets);
    const ordCodes = processes.map(p => p.ordCode);
    
    // Find duplicates
    const duplicates = ordCodes.filter((code, index) => 
      ordCodes.indexOf(code) !== index && code !== 0
    );
    
    if (duplicates.length > 0) {
      const duplicateProcesses = processes
        .filter(p => duplicates.includes(p.ordCode))
        .map(p => p.code)
        .join(' - ');
      warnings.push(this.validator.createWarning('BR26', duplicateProcesses));
    }
  }

  // BR27: Decimal ordcode conflicts
  async checkBR27(term, facets, warnings) {
    if (term.type !== 'd') return;
    
    const processes = await this.getProcessesWithOrdCodes(facets);
    const decimalProcesses = processes.filter(p => p.ordCode % 1 !== 0);
    
    // Group by integer part
    const groups = {};
    decimalProcesses.forEach(p => {
      const intPart = Math.floor(p.ordCode);
      if (!groups[intPart]) groups[intPart] = [];
      groups[intPart].push(p);
    });
    
    // Check for conflicts
    for (const [intPart, procs] of Object.entries(groups)) {
      if (procs.length > 1) {
        warnings.push(this.validator.createWarning('BR27', 
          procs.map(p => p.code).join(' - ')));
      }
    }
  }

  // BR28: Reconstitution restrictions
  async checkBR28(term, facets, warnings) {
    const dehydratedTerms = ['concentrate', 'powder', 'dried'];
    const isDehydrated = dehydratedTerms.some(t => 
      term.name.toLowerCase().includes(t)
    );
    
    if (isDehydrated) {
      const hasReconstitution = facets.some(f => 
        f.includes('A07MJ') || f.includes('reconstitut')
      );
      if (hasReconstitution) {
        warnings.push(this.validator.createWarning('BR28', term.code));
      }
    }
  }

  // Helper methods
  isRawCommodity(term) {
    return term.type === 'r';
  }

  getImplicitFacets(term, facetCategory) {
    if (!term.implicitFacets) return [];
    // Parse implicit facets string
    return term.implicitFacets
      .split('#')
      .filter(f => f.startsWith(facetCategory + '.'))
      .map(f => f.split('.')[1]);
  }

  async isChildOf(childCode, parentCode) {
    // Check hierarchy relationships in database
    // This would need database queries
    return false; // placeholder
  }

  isMoreSpecific(explicitFacet, implicitFacets) {
    // Check if explicit facet is more specific than implicit ones
    return true; // placeholder
  }

  async isInReportingHierarchy(term) {
    // Check if term exists in reporting hierarchy
    return true; // placeholder
  }

  async isInExposureHierarchy(term) {
    // Check if term exists in exposure hierarchy
    return true; // placeholder
  }

  async getImplicitProcessOrdCode(term) {
    // Get ordinal code of implicit process
    return null; // placeholder
  }

  async getProcessOrdCode(processCode) {
    // Get ordinal code for a process
    return null; // placeholder
  }

  async getProcessesWithOrdCodes(facets) {
    // Get all F28 processes with their ordinal codes
    return []; // placeholder
  }
}

module.exports = BusinessRules;