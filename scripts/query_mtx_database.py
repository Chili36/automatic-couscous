#!/usr/bin/env python3
"""
Example queries for the MTX SQLite database
"""
import sqlite3
import json

def run_query(conn, query, description):
    """Run a query and display results"""
    print(f"\n{description}")
    print("-" * 80)
    cursor = conn.cursor()
    cursor.execute(query)
    results = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    if results:
        # Print header
        print(" | ".join(columns))
        print("-" * 80)
        # Print first 10 results
        for i, row in enumerate(results[:10]):
            print(" | ".join(str(val) if val is not None else "NULL" for val in row))
        if len(results) > 10:
            print(f"... and {len(results) - 10} more rows")
    else:
        print("No results found")
    
    return results

def main():
    db_path = "/Users/davidfoster/Dev/catalogue-browser/foodex2-validator/data/mtx.db"
    conn = sqlite3.connect(db_path)
    
    print("MTX Database Query Examples")
    print("=" * 80)
    
    # 1. Basic catalogue info
    run_query(conn, """
        SELECT code, name, label, version, status
        FROM catalogue
    """, "1. Catalogue Information")
    
    # 2. List all hierarchies
    run_query(conn, """
        SELECT code, name, label, applicability, hierarchy_order
        FROM hierarchies
        ORDER BY hierarchy_order
        LIMIT 10
    """, "2. Available Hierarchies")
    
    # 3. List all attributes/facets
    run_query(conn, """
        SELECT code, name, label, attribute_type, single_or_repeatable
        FROM attributes
        WHERE deprecated = 0
        ORDER BY attribute_order
        LIMIT 10
    """, "3. Available Attributes/Facets")
    
    # 4. Sample terms
    run_query(conn, """
        SELECT term_code, extended_name, term_type, detail_level, deprecated
        FROM terms
        LIMIT 10
    """, "4. Sample Terms")
    
    # 5. Terms by type
    run_query(conn, """
        SELECT term_type, COUNT(*) as count
        FROM terms
        WHERE term_type IS NOT NULL
        GROUP BY term_type
        ORDER BY count DESC
    """, "5. Terms by Type")
    
    # 6. Find apple-related terms
    run_query(conn, """
        SELECT term_code, extended_name, term_type, common_names
        FROM terms
        WHERE LOWER(extended_name) LIKE '%apple%' 
           OR LOWER(common_names) LIKE '%apple%'
        LIMIT 10
    """, "6. Apple-related Terms")
    
    # 7. Terms with facets
    run_query(conn, """
        SELECT term_code, extended_name, all_facets
        FROM terms
        WHERE all_facets IS NOT NULL 
          AND all_facets != ''
        LIMIT 5
    """, "7. Terms with Facets")
    
    # 8. Term hierarchy relationships
    run_query(conn, """
        SELECT 
            t.term_code,
            t.extended_name,
            th.hierarchy_code,
            th.parent_code,
            p.extended_name as parent_name
        FROM terms t
        JOIN term_hierarchies th ON t.term_code = th.term_code
        LEFT JOIN terms p ON th.parent_code = p.term_code
        WHERE th.hierarchy_code = 'report'
          AND th.parent_code IS NOT NULL
        LIMIT 10
    """, "8. Term Hierarchy Relationships (Reporting Hierarchy)")
    
    # 9. Recent release notes
    run_query(conn, """
        SELECT operation_name, operation_date, operation_info
        FROM release_notes
        ORDER BY operation_date DESC
        LIMIT 10
    """, "9. Recent Release Notes")
    
    # 10. Terms with multiple codes
    run_query(conn, """
        SELECT 
            term_code,
            extended_name,
            GEMS_code,
            matrix_code,
            langual_code,
            foodex_old_code
        FROM terms
        WHERE GEMS_code IS NOT NULL 
           OR matrix_code IS NOT NULL
           OR langual_code IS NOT NULL
           OR foodex_old_code IS NOT NULL
        LIMIT 10
    """, "10. Terms with External Code Mappings")
    
    # 11. Create a view for easy term searching
    print("\n11. Creating Useful Views")
    print("-" * 80)
    cursor = conn.cursor()
    
    # View for searchable terms with hierarchy info
    cursor.execute("""
        CREATE VIEW IF NOT EXISTS v_searchable_terms AS
        SELECT DISTINCT
            t.term_code,
            t.extended_name,
            t.short_name,
            t.term_type,
            t.detail_level,
            t.deprecated,
            t.status,
            t.common_names,
            t.scientific_names,
            GROUP_CONCAT(DISTINCT th.hierarchy_code) as hierarchies,
            GROUP_CONCAT(DISTINCT th.parent_code) as parent_codes
        FROM terms t
        LEFT JOIN term_hierarchies th ON t.term_code = th.term_code
        GROUP BY t.term_code
    """)
    
    # View for facet descriptors
    cursor.execute("""
        CREATE VIEW IF NOT EXISTS v_facet_descriptors AS
        SELECT 
            t.term_code,
            t.extended_name,
            th.hierarchy_code as facet_code,
            a.name as facet_name,
            a.label as facet_label,
            th.parent_code,
            p.extended_name as parent_name
        FROM terms t
        JOIN term_hierarchies th ON t.term_code = th.term_code
        JOIN attributes a ON th.hierarchy_code = a.code
        LEFT JOIN terms p ON th.parent_code = p.term_code
        WHERE a.attribute_type = 'catalogue'
    """)
    
    print("Created views: v_searchable_terms, v_facet_descriptors")
    
    # 12. Example: Build a term with facets
    print("\n12. Example: Building a Term with Facets")
    print("-" * 80)
    
    # Get a base term
    cursor.execute("""
        SELECT term_code, extended_name, all_facets, implicit_facets
        FROM terms
        WHERE term_code = 'A0EZJ'  -- Apples
    """)
    result = cursor.fetchone()
    if result:
        print(f"Base term: {result[0]} - {result[1]}")
        print(f"All facets: {result[2]}")
        print(f"Implicit facets: {result[3]}")
    
    conn.close()
    print("\n" + "=" * 80)
    print("Query examples complete!")

if __name__ == "__main__":
    main()