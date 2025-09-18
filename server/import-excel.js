const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// This script imports the MTX Excel file into SQLite
// Note: A Python script has already done this, but this is the Node.js version

const excelPath = path.join(__dirname, '../../MTX_16.2.xlsx');
const dbPath = path.join(__dirname, '../data/mtx.db');

console.log('Reading Excel file...');
const workbook = XLSX.readFile(excelPath);

// Get the terms sheet
const termsSheet = workbook.Sheets['term'];
const terms = XLSX.utils.sheet_to_json(termsSheet);

console.log(`Found ${terms.length} terms`);

// Get the attribute sheet (facets)
const attrSheet = workbook.Sheets['attribute'];
const attributes = XLSX.utils.sheet_to_json(attrSheet);

console.log(`Found ${attributes.length} attributes`);

// Connect to database
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Clear existing data
  db.run('DELETE FROM terms');
  db.run('DELETE FROM facets');
  
  // Insert terms
  const insertTerm = db.prepare(`
    INSERT INTO terms (code, name, type, state, deprecated, dismissed, all_facets, implicit_facets, corex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  terms.forEach(term => {
    insertTerm.run(
      term.termCode,
      term.termExtendedName,
      term.termType || 'unknown',
      term.state,
      term.deprecated === 'Y' ? 1 : 0,
      term.state === 'DISMISSED' ? 1 : 0,
      term.allFacets || '',
      term.implicitFacets || '',
      term.corex || ''
    );
  });

  insertTerm.finalize();

  // Insert facets
  const insertFacet = db.prepare(`
    INSERT INTO facets (code, name, category)
    VALUES (?, ?, ?)
  `);

  attributes.forEach(attr => {
    insertFacet.run(
      attr.attributeCode,
      attr.attributeExtendedName,
      attr.attributeReportableHierarchyCode || ''
    );
  });

  insertFacet.finalize();

  console.log('Import complete!');
});

db.close();