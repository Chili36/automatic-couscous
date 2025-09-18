#!/usr/bin/env python3
"""
Import MTX Excel file data into SQLite database for FoodEx2 validator
"""
import pandas as pd
import sqlite3
import os
import json
from datetime import datetime

def parse_term_facets(facets_str):
    """Parse the facets string into a structured format"""
    if pd.isna(facets_str) or not facets_str:
        return []
    
    facets = []
    # Parse format: A000A#F01.A059P$F02.A066Q$F27.A000A$F33.A0C4A
    if '#' in facets_str:
        parts = facets_str.split('#')
        if len(parts) > 1:
            facet_part = parts[1]
            for facet in facet_part.split('$'):
                if '.' in facet:
                    facet_code, facet_value = facet.split('.', 1)
                    facets.append({'code': facet_code, 'value': facet_value})
    return facets

def clean_boolean(value):
    """Convert various boolean representations to 0/1"""
    if pd.isna(value):
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value > 0 else 0
    return 0

def clean_text(value):
    """Clean text values"""
    if pd.isna(value):
        return None
    return str(value).strip()

def convert_date(value):
    """Convert date string to ISO format"""
    if pd.isna(value) or not value:
        return None
    try:
        # Handle format like '2025/05/08'
        if isinstance(value, str) and '/' in value:
            return datetime.strptime(value, '%Y/%m/%d').isoformat()
        return str(value)
    except:
        return None

def import_mtx_to_sqlite(excel_path, db_path):
    """Import MTX Excel data into SQLite database"""
    
    print(f"Loading Excel file: {excel_path}")
    xl_file = pd.ExcelFile(excel_path)
    
    # Create/connect to database
    print(f"Creating/connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    print("Creating database schema...")
    
    # Catalogue table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS catalogue (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT,
            scope_note TEXT,
            version TEXT,
            last_update TEXT,
            valid_from TEXT,
            valid_to TEXT,
            status TEXT,
            deprecated INTEGER DEFAULT 0,
            term_code_mask TEXT,
            term_code_length INTEGER,
            term_min_code TEXT,
            accept_non_standard_codes INTEGER DEFAULT 0,
            generate_missing_codes INTEGER DEFAULT 0,
            catalogue_groups TEXT
        )
    ''')
    
    # Hierarchies table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS hierarchies (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT,
            scope_note TEXT,
            applicability TEXT,
            hierarchy_order INTEGER,
            version TEXT,
            last_update TEXT,
            valid_from TEXT,
            valid_to TEXT,
            status TEXT,
            deprecated INTEGER DEFAULT 0,
            hierarchy_groups TEXT
        )
    ''')
    
    # Attributes/Facets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attributes (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT,
            scope_note TEXT,
            reportable TEXT,
            visible INTEGER DEFAULT 1,
            searchable INTEGER DEFAULT 1,
            attribute_order INTEGER,
            attribute_type TEXT,
            max_length INTEGER,
            precision INTEGER,
            scale INTEGER,
            catalogue_code TEXT,
            single_or_repeatable TEXT,
            inheritance TEXT,
            uniqueness INTEGER DEFAULT 0,
            term_code_alias INTEGER DEFAULT 0,
            version TEXT,
            last_update TEXT,
            valid_from TEXT,
            valid_to TEXT,
            status TEXT,
            deprecated INTEGER DEFAULT 0
        )
    ''')
    
    # Terms table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS terms (
            term_code TEXT PRIMARY KEY,
            extended_name TEXT NOT NULL,
            short_name TEXT,
            scope_note TEXT,
            version TEXT,
            last_update TEXT,
            valid_from TEXT,
            valid_to TEXT,
            status TEXT,
            deprecated INTEGER DEFAULT 0,
            scientific_names TEXT,
            common_names TEXT,
            all_facets TEXT,
            implicit_facets TEXT,
            detail_level TEXT,
            term_type TEXT,
            -- Additional code mappings
            ISSCAAP TEXT,
            taxonomic_code TEXT,
            alpha3_code TEXT,
            GEMS_code TEXT,
            matrix_code TEXT,
            langual_code TEXT,
            foodex_old_code TEXT,
            -- Production information
            prod_treat TEXT,
            prod_meth TEXT,
            prod_pack TEXT,
            -- Other codes
            eurings_code TEXT,
            IFN_code TEXT,
            EU_feed_reg TEXT,
            EPPO_code TEXT,
            vector_net_code TEXT,
            ADDFOOD_code TEXT
        )
    ''')
    
    # Term hierarchy relationships table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS term_hierarchies (
            term_code TEXT,
            hierarchy_code TEXT,
            parent_code TEXT,
            term_order INTEGER,
            reportable INTEGER DEFAULT 1,
            flag INTEGER DEFAULT 1,
            hierarchy_path TEXT,
            PRIMARY KEY (term_code, hierarchy_code),
            FOREIGN KEY (term_code) REFERENCES terms(term_code),
            FOREIGN KEY (hierarchy_code) REFERENCES hierarchies(code)
        )
    ''')
    
    # Release notes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS release_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_name TEXT,
            operation_date TEXT,
            operation_info TEXT,
            operation_group_id INTEGER
        )
    ''')
    
    # Import catalogue data
    print("\nImporting catalogue data...")
    cat_df = pd.read_excel(xl_file, sheet_name='catalogue')
    for _, row in cat_df.iterrows():
        cursor.execute('''
            INSERT OR REPLACE INTO catalogue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            clean_text(row['code']),
            clean_text(row['name']),
            clean_text(row['label']),
            clean_text(row['scopeNote']),
            clean_text(row['version']),
            convert_date(row['lastUpdate']),
            convert_date(row['validFrom']),
            convert_date(row['validTo']),
            clean_text(row['status']),
            clean_boolean(row['deprecated']),
            clean_text(row['termCodeMask']),
            int(row['termCodeLength']) if not pd.isna(row['termCodeLength']) else None,
            clean_text(row['termMinCode']),
            clean_boolean(row['acceptNonStandardCodes']),
            clean_boolean(row['generateMissingCodes']),
            clean_text(row['catalogueGroups'])
        ))
    print(f"  Imported {len(cat_df)} catalogue entries")
    
    # Import hierarchies
    print("\nImporting hierarchies...")
    hier_df = pd.read_excel(xl_file, sheet_name='hierarchy')
    for _, row in hier_df.iterrows():
        cursor.execute('''
            INSERT OR REPLACE INTO hierarchies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            clean_text(row['code']),
            clean_text(row['name']),
            clean_text(row['label']),
            clean_text(row['scopeNote']),
            clean_text(row['hierarchyApplicability']),
            int(row['hierarchyOrder']) if not pd.isna(row['hierarchyOrder']) else None,
            clean_text(row['version']),
            convert_date(row['lastUpdate']),
            convert_date(row['validFrom']),
            convert_date(row['validTo']),
            clean_text(row['status']),
            clean_boolean(row['deprecated']),
            clean_text(row['hierarchyGroups'])
        ))
    print(f"  Imported {len(hier_df)} hierarchies")
    
    # Import attributes
    print("\nImporting attributes...")
    attr_df = pd.read_excel(xl_file, sheet_name='attribute')
    for _, row in attr_df.iterrows():
        cursor.execute('''
            INSERT OR REPLACE INTO attributes VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            clean_text(row['code']),
            clean_text(row['name']),
            clean_text(row['label']),
            clean_text(row['scopeNote']),
            clean_text(row['attributeReportable']),
            clean_boolean(row['attributeVisible']),
            clean_boolean(row['attributeSearchable']),
            int(row['attributeOrder']) if not pd.isna(row['attributeOrder']) else None,
            clean_text(row['attributeType']),
            int(row['attributeMaxLength']) if not pd.isna(row['attributeMaxLength']) else None,
            int(row['attributePrecision']) if not pd.isna(row['attributePrecision']) else None,
            int(row['attributeScale']) if not pd.isna(row['attributeScale']) else None,
            clean_text(row['attributeCatalogueCode']),
            clean_text(row['attributeSingleOrRepeatable']),
            clean_text(row['attributeInheritance']),
            clean_boolean(row['attributeUniqueness']),
            clean_boolean(row['attributeTermCodeAlias']),
            clean_text(row['version']),
            convert_date(row['lastUpdate']),
            convert_date(row['validFrom']),
            convert_date(row['validTo']),
            clean_text(row['status']),
            clean_boolean(row['deprecated'])
        ))
    print(f"  Imported {len(attr_df)} attributes")
    
    # Import terms
    print("\nImporting terms...")
    terms_df = pd.read_excel(xl_file, sheet_name='term')
    
    # Get hierarchy columns
    hierarchy_cols = [col for col in terms_df.columns if col.endswith('Flag')]
    hierarchy_names = [col.replace('Flag', '') for col in hierarchy_cols]
    
    total_terms = len(terms_df)
    batch_size = 1000
    
    for i in range(0, total_terms, batch_size):
        batch_df = terms_df.iloc[i:i+batch_size]
        
        for _, row in batch_df.iterrows():
            # Insert term
            cursor.execute('''
                INSERT OR REPLACE INTO terms VALUES 
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                clean_text(row['termCode']),
                clean_text(row['termExtendedName']),
                clean_text(row['termShortName']),
                clean_text(row['termScopeNote']),
                clean_text(row['version']),
                convert_date(row['lastUpdate']),
                convert_date(row['validFrom']),
                convert_date(row['validTo']),
                clean_text(row['status']),
                clean_boolean(row['deprecated']),
                clean_text(row['scientificNames']),
                clean_text(row['commonNames']),
                clean_text(row['allFacets']),
                clean_text(row['implicitFacets']),
                clean_text(row['detailLevel']),
                clean_text(row['termType']),
                clean_text(row['ISSCAAP']),
                clean_text(row['taxonomicCode']),
                clean_text(row['alpha3Code']),
                clean_text(row['GEMSCode']),
                clean_text(row['matrixCode']),
                clean_text(row['LangualCode']),
                clean_text(row['foodexOldCode']),
                clean_text(row['prodTreat']),
                clean_text(row['prodMeth']),
                clean_text(row['prodPack']),
                clean_text(row['EuringsCode']),
                clean_text(row['IFNCode']),
                clean_text(row['EUFeedReg']),
                clean_text(row['EPPOCode']),
                clean_text(row['VectorNetCode']),
                clean_text(row['ADDFOODCode'])
            ))
            
            # Insert hierarchy relationships
            for hier_name in hierarchy_names:
                flag_col = f'{hier_name}Flag'
                parent_col = f'{hier_name}ParentCode'
                order_col = f'{hier_name}Order'
                reportable_col = f'{hier_name}Reportable'
                hierarchy_code_col = f'{hier_name}HierarchyCode'
                
                if flag_col in row and not pd.isna(row[flag_col]) and row[flag_col]:
                    cursor.execute('''
                        INSERT OR REPLACE INTO term_hierarchies VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        clean_text(row['termCode']),
                        hier_name,
                        clean_text(row.get(parent_col)),
                        int(row[order_col]) if order_col in row and not pd.isna(row.get(order_col)) else None,
                        clean_boolean(row.get(reportable_col, 1)),
                        clean_boolean(row[flag_col]),
                        clean_text(row.get(hierarchy_code_col))
                    ))
        
        print(f"  Processed {min(i+batch_size, total_terms)}/{total_terms} terms...")
    
    print(f"  Total imported: {total_terms} terms")
    
    # Import release notes
    print("\nImporting release notes...")
    notes_df = pd.read_excel(xl_file, sheet_name='releaseNotes')
    for _, row in notes_df.iterrows():
        cursor.execute('''
            INSERT INTO release_notes (operation_name, operation_date, operation_info, operation_group_id) 
            VALUES (?, ?, ?, ?)
        ''', (
            clean_text(row['operationName']),
            convert_date(row['operationDate']),
            clean_text(row['operationInfo']),
            int(row['operationGroupId']) if not pd.isna(row['operationGroupId']) else None
        ))
    print(f"  Imported {len(notes_df)} release notes")
    
    # Create indexes
    print("\nCreating indexes...")
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_terms_type ON terms(term_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_terms_deprecated ON terms(deprecated)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_terms_status ON terms(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_term_hier_parent ON term_hierarchies(parent_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_term_hier_hierarchy ON term_hierarchies(hierarchy_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attributes_type ON attributes(attribute_type)')
    
    # Commit and close
    conn.commit()
    conn.close()
    
    print("\nImport complete!")
    print(f"Database created at: {db_path}")
    
    # Print summary statistics
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\nDatabase summary:")
    cursor.execute("SELECT COUNT(*) FROM catalogue")
    print(f"  Catalogues: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM hierarchies")
    print(f"  Hierarchies: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM attributes")
    print(f"  Attributes: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM terms")
    print(f"  Terms: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM term_hierarchies")
    print(f"  Term-Hierarchy relationships: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT COUNT(*) FROM release_notes")
    print(f"  Release notes: {cursor.fetchone()[0]}")
    
    conn.close()

if __name__ == "__main__":
    excel_path = "/Users/davidfoster/Dev/catalogue-browser/MTX_16.2.xlsx"
    db_path = "/Users/davidfoster/Dev/catalogue-browser/foodex2-validator/data/mtx.db"
    
    # Create data directory if it doesn't exist
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    import_mtx_to_sqlite(excel_path, db_path)