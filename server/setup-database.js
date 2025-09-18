const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/mtx.db');

// Create database
const db = new sqlite3.Database(dbPath);

console.log('Creating FoodEx2 database schema...');

db.serialize(() => {
  // Create terms table
  db.run(`
    CREATE TABLE IF NOT EXISTS terms (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      detail_level TEXT,
      state TEXT,
      deprecated BOOLEAN DEFAULT 0,
      dismissed BOOLEAN DEFAULT 0,
      parent_code TEXT,
      root_group TEXT,
      implicit_facets TEXT,
      all_facets TEXT,
      corex TEXT,
      foodex1_code TEXT,
      hierarchy_codes TEXT
    )
  `);

  // Create facets table
  db.run(`
    CREATE TABLE IF NOT EXISTS facets (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      hierarchy TEXT,
      single_cardinality BOOLEAN DEFAULT 0
    )
  `);

  // Create hierarchies table
  db.run(`
    CREATE TABLE IF NOT EXISTS hierarchies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_exposure BOOLEAN DEFAULT 0,
      is_reporting BOOLEAN DEFAULT 0
    )
  `);

  // Create term_hierarchies junction table
  db.run(`
    CREATE TABLE IF NOT EXISTS term_hierarchies (
      term_code TEXT,
      hierarchy_code TEXT,
      parent_code TEXT,
      order_num INTEGER,
      PRIMARY KEY (term_code, hierarchy_code),
      FOREIGN KEY (term_code) REFERENCES terms(code),
      FOREIGN KEY (hierarchy_code) REFERENCES hierarchies(code)
    )
  `);

  // Insert sample data for testing
  console.log('Inserting sample data...');

  // Sample hierarchies
  db.run(`INSERT OR IGNORE INTO hierarchies VALUES 
    ('expo', 'Exposure hierarchy', 1, 0),
    ('report', 'Reporting hierarchy', 0, 1),
    ('master', 'Master hierarchy', 0, 0)
  `);

  // Sample terms
  db.run(`INSERT OR IGNORE INTO terms 
    (code, name, type, deprecated, dismissed, root_group) VALUES 
    ('A0EZJ', 'Apples', 'raw_commodity', 0, 0, 'A04RK'),
    ('A000J', 'Grains and grain-based products', 'aggregated', 0, 0, 'A000L'),
    ('A0B6F', 'Fruit juice', 'derivative', 0, 0, 'A04RK'),
    ('A000L', 'Cereal grains', 'raw_commodity', 0, 0, 'A000L'),
    ('A04RK', 'Fruit used as fruit', 'hierarchy', 0, 0, 'A04RK')
  `);

  // Sample facets
  db.run(`INSERT OR IGNORE INTO facets 
    (code, name, category, hierarchy, single_cardinality) VALUES 
    ('F01', 'Source', 'SOURCE', 'A16MJ', 0),
    ('F27', 'Source commodities', 'SOURCE-COMMODITIES', 'A0001', 0),
    ('F28', 'Process', 'PROCESS', 'A07XS', 0),
    ('F03', 'Physical state', 'PHYSICAL-STATE', 'A0BZS', 1)
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_terms_type ON terms(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_terms_root ON terms(root_group)');
  db.run('CREATE INDEX IF NOT EXISTS idx_facets_category ON facets(category)');

  console.log('Database setup complete!');
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database connection closed.');
    console.log('\nTo import your MTX data from Excel:');
    console.log('1. Export your Excel sheets to CSV');
    console.log('2. Use the import-mtx.js script (to be created)');
    console.log('\nDatabase created at:', dbPath);
  }
});