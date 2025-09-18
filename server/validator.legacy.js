const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');
const CompleteBusinessRules = require('./complete-business-rules');

class FoodEx2Validator {
  constructor() {
    this.db = null;
    this.forbiddenProcesses = [];
    this.warningMessages = {};
    this.warningColors = {};
    this.businessRules = null; // Initialize after DB is ready
    this.initialize();
  }

  async initialize() {
    try {
      // Load business rules data
      await this.loadForbiddenProcesses();
      await this.loadWarningMessages();
      await this.loadWarningColors();
      
      // Initialize database
      this.db = new sqlite3.Database(path.join(__dirname, '../data/mtx.db'));
      
      // Initialize business rules after database is ready
      this.businessRules = new CompleteBusinessRules(this);
      
      console.log('FoodEx2 Validator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize validator:', error);
    }
  }

  async loadForbiddenProcesses() {
    const csvPath = path.join(__dirname, '../data/BR_Data.csv');
    const content = await fs.readFile(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true
    });
    this.forbiddenProcesses = records;
  }

  async loadWarningMessages() {
    const txtPath = path.join(__dirname, '../data/warningMessages.txt');
    const content = await fs.readFile(txtPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length >= 5) {
        const messageId = parseInt(parts[0]);
        const brCode = `BR${String(messageId).padStart(2, '0')}`;
        this.warningMessages[brCode] = {
          id: messageId,
          trigger: parts[1],
          text: parts[2],
          semaphoreLevel: parts[3],
          textLevel: parts[4]
        };
      }
    }
  }

  async loadWarningColors() {
    const txtPath = path.join(__dirname, '../data/warningColors.txt');
    try {
      const content = await fs.readFile(txtPath, 'utf-8');
      // Parse warning colors if needed
    } catch (error) {
      console.log('Warning colors file not found, using defaults');
    }
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
      warnings.push(this.createWarning('BR29', code));
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
      warnings.push(this.createWarning('BR29', 'Term not found: ' + parsed.baseTerm));
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
    // Basic structure: LETTER+NUMBER+[LETTER]+(#LETTER+NUMBER+.LETTER+NUMBER+)*
    const pattern = /^[A-Z][0-9]+[A-Z0-9]*(?:#[A-Z][0-9]+(?:\.[A-Z][0-9]+[A-Z0-9]*)*)*$/;
    return pattern.test(code);
  }

  parseCode(code) {
    const parts = code.split('#');
    return {
      baseTerm: parts[0],
      facets: parts.slice(1)
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
      warnings.push(this.createWarning('BR20', term.code));
    }
  }

  async checkDismissed(term, warnings) {
    if (term.dismissed) {
      warnings.push(this.createWarning('BR21', term.code));
    }
  }

  async checkNonSpecific(term, warnings) {
    if (term.type === 'non_specific') {
      warnings.push(this.createWarning('BR10', term.code));
    }
  }

  async checkIngredientFacets(term, facets, warnings) {
    // BR12: The F04 ingredient facet can only be used as a minor ingredient 
    // to derivative or raw primary commodity terms
    if (term.type === 'd' || term.type === 'r') {
      for (const facet of facets) {
        // Check if this is an F04 (ingredient) facet
        if (facet.startsWith('F04.')) {
          warnings.push(this.createWarning('BR12', `F04 ingredient facet used with ${term.type === 'd' ? 'derivative' : 'raw commodity'} term ${term.code}`));
        }
      }
    }
  }

  async checkForbiddenProcesses(term, facets, warnings) {
    if (term.type !== 'raw_commodity') return;
    
    const forbidden = this.forbiddenProcesses.filter(fp => 
      fp.ROOT_GROUP_CODE === term.code || 
      fp.ROOT_GROUP_CODE === term.parent_code
    );

    for (const facet of facets) {
      const facetCode = facet.split('.')[1] || facet;
      if (forbidden.some(fp => fp.FORBIDDEN_PROCS === facetCode)) {
        warnings.push(this.createWarning('BR19', facetCode));
      }
    }
  }

  async checkFacetValidity(facets, warnings) {
    // BR30, BR31: Check if facets are valid
    for (const facet of facets) {
      const parts = facet.split('.');
      
      // Check structure
      if (parts.length < 2) {
        warnings.push(this.createWarning('BR31', facet));
        continue;
      }
      
      // Extract facet category (F01, F02, etc.) and descriptor code
      const categoryMatch = parts[0].match(/^(F\d{2})/);
      if (!categoryMatch) {
        warnings.push(this.createWarning('BR30', facet));
        continue;
      }
      
      const categoryCode = categoryMatch[1];
      const descriptorCode = parts[1];
      
      // Check if facet category exists
      const category = await this.getFacetCategory(categoryCode);
      if (!category) {
        warnings.push(this.createWarning('BR30', categoryCode));
        continue;
      }
      
      // Check if descriptor exists in the hierarchy
      const descriptor = await this.getFacetDescriptor(descriptorCode);
      if (!descriptor) {
        warnings.push(this.createWarning('BR31', `${facet} - descriptor not found`));
      }
    }
  }

  async getFacetCategory(categoryCode) {
    return new Promise((resolve, reject) => {
      // Map facet codes to hierarchy names based on the Excel data
      const facetMap = {
        'F01': 'source',
        'F02': 'part-nature', 
        'F03': 'physical-state',
        'F04': 'ingredient',
        'F27': 'source-commodities',
        'F28': 'process'
      };
      
      resolve(facetMap[categoryCode] || null);
    });
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

  createWarning(ruleCode, additionalInfo = '') {
    const rule = this.warningMessages[ruleCode] || {
      text: `Unknown rule ${ruleCode}`,
      semaphoreLevel: 'HIGH',
      textLevel: 'HIGH'
    };

    return {
      rule: ruleCode,
      message: rule.text,
      semaphoreLevel: rule.semaphoreLevel,
      textLevel: rule.textLevel,
      additionalInfo
    };
  }

  calculateOverallLevel(warnings) {
    if (warnings.some(w => w.semaphoreLevel === 'ERROR')) return 'ERROR';
    if (warnings.some(w => w.semaphoreLevel === 'HIGH')) return 'HIGH';
    if (warnings.some(w => w.semaphoreLevel === 'LOW')) return 'LOW';
    return 'NONE';
  }

  getRulesInfo() {
    return Object.entries(this.warningMessages).map(([code, rule]) => ({
      code,
      description: rule.trigger,
      message: rule.text,
      severity: rule.semaphoreLevel
    }));
  }
}

module.exports = FoodEx2Validator;