const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

const dbPath = path.join(__dirname, '../data/mtx.db');
const db = new sqlite3.Database(dbPath);

async function setupCompleteDatabase() {
  console.log('Setting up complete database schema...');

  try {
    // Create missing tables
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Table for process ordinal codes
        db.run(`
          CREATE TABLE IF NOT EXISTS process_ordcodes (
            process_code TEXT PRIMARY KEY,
            process_name TEXT,
            ordinal_code REAL NOT NULL,
            root_group_code TEXT,
            root_group_label TEXT
          )
        `);

        // Table for forbidden processes (denormalized from BR_Data.csv)
        db.run(`
          CREATE TABLE IF NOT EXISTS forbidden_processes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_group_code TEXT NOT NULL,
            root_group_label TEXT,
            forbidden_process_code TEXT NOT NULL,
            forbidden_process_label TEXT,
            ordinal_code REAL,
            UNIQUE(root_group_code, forbidden_process_code)
          )
        `);

        // Table for business rules
        db.run(`
          CREATE TABLE IF NOT EXISTS business_rules (
            rule_id TEXT PRIMARY KEY,
            message_id INTEGER,
            trigger_description TEXT,
            message_text TEXT,
            semaphore_level TEXT,
            text_level TEXT
          )
        `);

        // Table for warning colors
        db.run(`
          CREATE TABLE IF NOT EXISTS warning_colors (
            level TEXT PRIMARY KEY,
            color_hex TEXT,
            color_name TEXT
          )
        `);

        // Indexes for performance
        db.run('CREATE INDEX IF NOT EXISTS idx_forbidden_root ON forbidden_processes(root_group_code)');
        db.run('CREATE INDEX IF NOT EXISTS idx_process_ord ON process_ordcodes(ordinal_code)');
        
        resolve();
      });
    });

    // Import BR_Data.csv
    console.log('Importing forbidden processes...');
    const brDataPath = path.join(__dirname, '../data/BR_Data.csv');
    const brDataContent = await fs.readFile(brDataPath, 'utf-8');
    const brData = parse(brDataContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true
    });

    // Insert forbidden processes
    const insertForbidden = db.prepare(`
      INSERT OR IGNORE INTO forbidden_processes 
      (root_group_code, root_group_label, forbidden_process_code, forbidden_process_label, ordinal_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Also collect unique processes for process_ordcodes table
    const processMap = new Map();

    for (const row of brData) {
      const ordCode = parseFloat(row.ORDINAL_CODE) || 0;
      
      // Insert into forbidden processes
      insertForbidden.run(
        row.ROOT_GROUP_CODE,
        row.ROOT_GROUP_LABEL,
        row.FORBIDDEN_PROCS,
        row.FORBIDDEN_PROCS_LABELS,
        ordCode
      );

      // Collect process info
      if (!processMap.has(row.FORBIDDEN_PROCS)) {
        processMap.set(row.FORBIDDEN_PROCS, {
          code: row.FORBIDDEN_PROCS,
          name: row.FORBIDDEN_PROCS_LABELS,
          ordinal: ordCode
        });
      }
    }
    insertForbidden.finalize();

    // Insert process ordinal codes
    const insertProcess = db.prepare(`
      INSERT OR IGNORE INTO process_ordcodes 
      (process_code, process_name, ordinal_code)
      VALUES (?, ?, ?)
    `);

    for (const [code, info] of processMap) {
      insertProcess.run(code, info.name, info.ordinal);
    }
    insertProcess.finalize();

    // Import warningMessages.txt
    console.log('Importing business rules...');
    const warningPath = path.join(__dirname, '../data/warningMessages.txt');
    const warningContent = await fs.readFile(warningPath, 'utf-8');
    const warningLines = warningContent.split('\n').filter(line => line.trim());

    const insertRule = db.prepare(`
      INSERT OR REPLACE INTO business_rules 
      (rule_id, message_id, trigger_description, message_text, semaphore_level, text_level)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Skip header line
    for (let i = 1; i < warningLines.length; i++) {
      const parts = warningLines[i].split(';');
      if (parts.length >= 5) {
        const messageId = parseInt(parts[0]);
        const ruleId = `BR${String(messageId).padStart(2, '0')}`;
        
        insertRule.run(
          ruleId,
          messageId,
          parts[1],
          parts[2],
          parts[3],
          parts[4]
        );
      }
    }
    insertRule.finalize();

    // Import warningColors.txt if it exists
    try {
      const colorsPath = path.join(__dirname, '../data/warningColors.txt');
      const colorsContent = await fs.readFile(colorsPath, 'utf-8');
      const colorLines = colorsContent.split('\n').filter(line => line.trim());

      const insertColor = db.prepare(`
        INSERT OR REPLACE INTO warning_colors (level, color_hex, color_name)
        VALUES (?, ?, ?)
      `);

      // Parse color data (adjust based on actual format)
      for (const line of colorLines) {
        if (line.includes(';')) {
          const parts = line.split(';');
          if (parts.length >= 2) {
            insertColor.run(parts[0], parts[1], parts[2] || '');
          }
        }
      }
      insertColor.finalize();
    } catch (err) {
      console.log('Warning colors file not found or invalid format');
    }

    // Add more complete hierarchy data if needed
    console.log('Ensuring hierarchy data...');
    // Check if hierarchies table has the columns we need
    db.all("PRAGMA table_info(hierarchies)", (err, columns) => {
      if (!err) {
        const hasExposureCol = columns.some(col => col.name === 'is_exposure');
        if (!hasExposureCol) {
          // Add columns if they don't exist
          db.run("ALTER TABLE hierarchies ADD COLUMN is_exposure INTEGER DEFAULT 0", (err) => {
            if (err && !err.message.includes('duplicate column')) {
              console.error('Error adding is_exposure column:', err);
            }
          });
          db.run("ALTER TABLE hierarchies ADD COLUMN is_reporting INTEGER DEFAULT 0", (err) => {
            if (err && !err.message.includes('duplicate column')) {
              console.error('Error adding is_reporting column:', err);
            }
          });
        }
      }
    });

    console.log('Database setup complete!');
    
    // Show summary
    db.get('SELECT COUNT(*) as count FROM forbidden_processes', (err, row) => {
      if (!err) console.log(`- Forbidden processes: ${row.count}`);
    });
    
    db.get('SELECT COUNT(*) as count FROM process_ordcodes', (err, row) => {
      if (!err) console.log(`- Process ordinal codes: ${row.count}`);
    });
    
    db.get('SELECT COUNT(*) as count FROM business_rules', (err, row) => {
      if (!err) console.log(`- Business rules: ${row.count}`);
    });

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  setupCompleteDatabase();
}

module.exports = setupCompleteDatabase;