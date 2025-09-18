const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const CompleteBusinessRules = require('./complete-business-rules');

class DatabaseValidator {
  constructor() {
    this.db = null;
    this.businessRules = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize database
      this.db = new sqlite3.Database(path.join(__dirname, '../data/mtx.db'));
      
      // Initialize business rules after database is ready
      this.businessRules = new CompleteBusinessRules(this);
      
      console.log('Database Validator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize validator:', error);
    }
  }

  // Load forbidden processes from database
  async getForbiddenProcesses(rootGroupCode) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM forbidden_processes WHERE root_group_code = ?`,
        [rootGroupCode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Get process ordinal code from database
  async getProcessOrdinalCode(processCode) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT ordinal_code FROM process_ordcodes WHERE process_code = ?`,
        [processCode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.ordinal_code : null);
        }
      );
    });
  }

  // Get business rule message from database
  async getBusinessRule(ruleId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM business_rules WHERE rule_id = ?`,
        [ruleId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async validate(code) {
    // Ensure validator is initialized
    if (!this.businessRules || !this.db) {
      throw new Error('Validator not fully initialized. Please try again.');
    }
    
    const warnings = [];
    const startTime = Date.now();

    // BR29: Structure validation
    if (!this.isValidStructure(code)) {
      warnings.push(await this.createWarning('BR29', code));
      return {
        code,
        valid: false,
        warnings,
        overallLevel: 'ERROR',
        processingTime: Date.now() - startTime
      };
    }

    // Parse code
    const parsed = this.parseCode(code);
    
    // Get base term from database
    const term = await this.getTerm(parsed.baseTerm);
    if (!term) {
      warnings.push(await this.createWarning('BR29', 'Term not found: ' + parsed.baseTerm));
      return {
        code,
        valid: false,
        warnings,
        overallLevel: 'ERROR',
        processingTime: Date.now() - startTime
      };
    }

    // Run ALL validation rules
    // Basic term checks
    await this.checkDeprecated(term, warnings); // BR20
    await this.checkDismissed(term, warnings); // BR21
    await this.checkNonSpecific(term, warnings); // BR10
    await this.businessRules.checkBR17(term, warnings); // Facets as base term
    await this.businessRules.checkBR23(term, warnings); // Hierarchy as base term
    await this.businessRules.checkBR24(term, warnings); // Non-exposure hierarchy
    await this.businessRules.checkBR08(term, warnings); // Non-reportable terms
    
    // Source and composite rules
    await this.businessRules.checkBR01(term, parsed.facets, warnings);
    await this.businessRules.checkBR03(term, parsed.facets, warnings);
    await this.businessRules.checkBR04(term, parsed.facets, warnings);
    await this.businessRules.checkBR05(term, parsed.facets, warnings);
    await this.businessRules.checkBR06(term, parsed.facets, warnings);
    await this.businessRules.checkBR07(term, parsed.facets, warnings);
    
    // Process and facet rules
    await this.businessRules.checkBR11(term, parsed.facets, warnings);
    await this.checkIngredientFacets(term, parsed.facets, warnings); // BR12
    await this.businessRules.checkBR13(term, parsed.facets, warnings);
    await this.businessRules.checkBR16(term, parsed.facets, warnings);
    await this.checkForbiddenProcesses(term, parsed.facets, warnings); // BR19
    await this.businessRules.checkBR25(term, parsed.facets, warnings);
    await this.businessRules.checkBR26(term, parsed.facets, warnings);
    await this.businessRules.checkBR27(term, parsed.facets, warnings);
    await this.businessRules.checkBR28(term, parsed.facets, warnings);
    
    // Structure validation
    await this.checkFacetValidity(parsed.facets, warnings); // BR30, BR31
    
    // Calculate overall level
    const overallLevel = this.calculateOverallLevel(warnings);
    
    return {
      code,
      valid: overallLevel !== 'ERROR',
      baseTerm: {
        code: term.code,
        name: term.name,
        type: term.type
      },
      facets: parsed.facets,
      warnings,
      overallLevel,
      processingTime: Date.now() - startTime
    };
  }

  isValidStructure(code) {
    // Updated pattern to handle both # and $ as facet separators
    const pattern = /^[A-Z][0-9]+[A-Z0-9]*(?:[#$][A-Z][0-9]+(?:\.[A-Z][0-9]+[A-Z0-9]*)*)*$/;
    return pattern.test(code);
  }

  parseCode(code) {
    // Split by # to get base term and rest
    const parts = code.split('#');
    const baseTerm = parts[0];
    
    // Handle remaining facets with both # and $ separators
    const facetString = parts.slice(1).join('#');
    const facets = facetString ? facetString.split(/[#$]/).filter(f => f.trim()) : [];
    
    return {
      baseTerm,
      facets
    };
  }

  async getTerm(code) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT term_code, extended_name, short_name, term_type, status, deprecated, all_facets, implicit_facets 
         FROM terms 
         WHERE term_code = ?`,
        [code],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              code: row.term_code,
              name: row.extended_name || row.short_name,
              type: row.term_type || 'unknown',
              deprecated: row.deprecated === 1,
              dismissed: row.status === 'DISMISSED',
              allFacets: row.all_facets,
              implicitFacets: row.implicit_facets
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async checkDeprecated(term, warnings) {
    if (term.deprecated) {
      warnings.push(await this.createWarning('BR20', term.code));
    }
  }

  async checkDismissed(term, warnings) {
    if (term.dismissed) {
      warnings.push(await this.createWarning('BR21', term.code));
    }
  }

  async checkNonSpecific(term, warnings) {
    if (term.type === 'n') {
      warnings.push(await this.createWarning('BR10', term.code));
    }
  }

  async checkIngredientFacets(term, facets, warnings) {
    if (term.type === 'd' || term.type === 'r') {
      for (const facet of facets) {
        if (facet.startsWith('F04.')) {
          warnings.push(await this.createWarning('BR12', 
            `F04 ingredient facet used with ${term.type === 'd' ? 'derivative' : 'raw commodity'} term ${term.code}`));
        }
      }
    }
  }

  async checkForbiddenProcesses(term, facets, warnings) {
    if (term.type !== 'r') return;
    
    // Get forbidden processes from database
    const forbidden = await this.getForbiddenProcesses(term.code);
    
    for (const facet of facets) {
      if (facet.startsWith('F28.')) {
        const processCode = facet.split('.')[1];
        if (forbidden.some(fp => fp.forbidden_process_code === processCode)) {
          warnings.push(await this.createWarning('BR19', processCode));
        }
      }
    }
  }

  async checkFacetValidity(facets, warnings) {
    for (const facet of facets) {
      const parts = facet.split('.');
      
      if (parts.length < 2) {
        warnings.push(await this.createWarning('BR31', facet));
        continue;
      }
      
      const categoryMatch = parts[0].match(/^(F\d{2})/);
      if (!categoryMatch) {
        warnings.push(await this.createWarning('BR30', facet));
        continue;
      }
      
      const categoryCode = categoryMatch[1];
      const descriptorCode = parts[1];
      
      // Check if descriptor exists
      const descriptor = await this.getFacetDescriptor(descriptorCode);
      if (!descriptor) {
        // ICT reports non-existent descriptors as BR29 (structure/spelling error)
        warnings.push(await this.createWarning('BR29', `Facet term not correct (${descriptorCode})`));
      }
    }
  }

  async getFacetDescriptor(code) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT term_code, extended_name FROM terms WHERE term_code = ?',
        [code],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? { code: row.term_code, name: row.extended_name } : null);
        }
      );
    });
  }

  async createWarning(ruleCode, additionalInfo = '') {
    const rule = await this.getBusinessRule(ruleCode);
    
    if (!rule) {
      return {
        rule: ruleCode,
        message: `Unknown rule ${ruleCode}`,
        semaphoreLevel: 'HIGH',
        textLevel: 'HIGH',
        additionalInfo
      };
    }

    return {
      rule: ruleCode,
      message: rule.message_text,
      semaphoreLevel: rule.semaphore_level,
      textLevel: rule.text_level,
      additionalInfo
    };
  }

  calculateOverallLevel(warnings) {
    if (warnings.some(w => w.semaphoreLevel === 'ERROR')) return 'ERROR';
    if (warnings.some(w => w.semaphoreLevel === 'HIGH')) return 'HIGH';
    if (warnings.some(w => w.semaphoreLevel === 'LOW')) return 'LOW';
    return 'NONE';
  }

  async getRulesInfo() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM business_rules ORDER BY message_id',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            code: row.rule_id,
            description: row.trigger_description,
            message: row.message_text,
            severity: row.semaphore_level
          })));
        }
      );
    });
  }
}

module.exports = DatabaseValidator;