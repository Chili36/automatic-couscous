#!/usr/bin/env python3
"""
FoodEx2 Validator Query Functions
This module provides the key database queries needed for validating FoodEx2 codes
"""
import sqlite3
import re
from typing import Dict, List, Tuple, Optional, Set

class FoodEx2Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
    
    def close(self):
        self.conn.close()
    
    def get_term(self, term_code: str) -> Optional[Dict]:
        """Get a term by its code"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM terms WHERE term_code = ?
        """, (term_code,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_facet(self, facet_code: str) -> Optional[Dict]:
        """Get a facet/attribute by its code"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM attributes WHERE code = ?
        """, (facet_code,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def is_valid_term(self, term_code: str) -> bool:
        """Check if a term code exists and is not deprecated"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 1 FROM terms 
            WHERE term_code = ? AND deprecated = 0
        """, (term_code,))
        return cursor.fetchone() is not None
    
    def is_valid_facet(self, facet_code: str) -> bool:
        """Check if a facet code exists and is not deprecated"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 1 FROM attributes 
            WHERE code = ? AND deprecated = 0
        """, (facet_code,))
        return cursor.fetchone() is not None
    
    def get_facet_descriptors(self, facet_code: str) -> List[Dict]:
        """Get all valid descriptors for a facet"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT t.term_code, t.extended_name, t.deprecated
            FROM terms t
            JOIN term_hierarchies th ON t.term_code = th.term_code
            WHERE th.hierarchy_code = ?
            ORDER BY th.term_order
        """, (facet_code,))
        return [dict(row) for row in cursor.fetchall()]
    
    def get_implicit_facets(self, term_code: str) -> List[Tuple[str, str]]:
        """Get implicit facets for a term"""
        term = self.get_term(term_code)
        if not term or not term['implicit_facets']:
            return []
        
        facets = []
        # Parse format: F01.A059P$F27.A000A$F33.A0C4A
        for facet_str in term['implicit_facets'].split('$'):
            if '.' in facet_str:
                facet_code, descriptor_code = facet_str.split('.', 1)
                facets.append((facet_code, descriptor_code))
        return facets
    
    def get_hierarchy_path(self, term_code: str, hierarchy_code: str) -> List[str]:
        """Get the full hierarchy path for a term"""
        path = []
        current_code = term_code
        
        cursor = self.conn.cursor()
        max_depth = 20  # Prevent infinite loops
        
        while current_code and max_depth > 0:
            cursor.execute("""
                SELECT parent_code FROM term_hierarchies
                WHERE term_code = ? AND hierarchy_code = ?
            """, (current_code, hierarchy_code))
            row = cursor.fetchone()
            
            if row and row['parent_code']:
                path.insert(0, row['parent_code'])
                current_code = row['parent_code']
            else:
                break
            
            max_depth -= 1
        
        path.append(term_code)
        return path
    
    def validate_foodex2_code(self, code: str) -> Dict:
        """
        Validate a FoodEx2 code with facets
        Format: BASE#F01.DESC1$F02.DESC2
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'base_term': None,
            'facets': []
        }
        
        # Parse the code
        if '#' in code:
            base_code, facets_str = code.split('#', 1)
        else:
            base_code = code
            facets_str = ''
        
        # Validate base term
        if not self.is_valid_term(base_code):
            result['valid'] = False
            result['errors'].append(f"Invalid base term code: {base_code}")
        else:
            result['base_term'] = self.get_term(base_code)
            
            # Check if term is deprecated
            if result['base_term']['deprecated']:
                result['warnings'].append(f"Base term {base_code} is deprecated")
        
        # Parse and validate facets
        seen_facets = set()
        if facets_str:
            facet_pairs = facets_str.split('$')
            
            for facet_pair in facet_pairs:
                if '.' not in facet_pair:
                    result['valid'] = False
                    result['errors'].append(f"Invalid facet format: {facet_pair}")
                    continue
                
                facet_code, descriptor_code = facet_pair.split('.', 1)
                
                # Check if facet exists
                facet = self.get_facet(facet_code)
                if not facet:
                    result['valid'] = False
                    result['errors'].append(f"Invalid facet code: {facet_code}")
                    continue
                
                # Check for duplicate facets
                if facet_code in seen_facets and facet['single_or_repeatable'] == 'single':
                    result['valid'] = False
                    result['errors'].append(f"Facet {facet_code} can only appear once")
                
                seen_facets.add(facet_code)
                
                # Validate descriptor
                descriptors = self.get_facet_descriptors(facet_code)
                valid_descriptors = [d['term_code'] for d in descriptors if not d['deprecated']]
                
                descriptor = None
                if descriptor_code not in valid_descriptors:
                    result['valid'] = False
                    result['errors'].append(f"Invalid descriptor {descriptor_code} for facet {facet_code}")
                else:
                    # Check if descriptor is deprecated
                    descriptor = next((d for d in descriptors if d['term_code'] == descriptor_code), None)
                    if descriptor and descriptor['deprecated']:
                        result['warnings'].append(f"Descriptor {descriptor_code} is deprecated")
                
                result['facets'].append({
                    'facet_code': facet_code,
                    'facet_name': facet['name'],
                    'descriptor_code': descriptor_code,
                    'descriptor': descriptor
                })
        
        # Check implicit facets
        if result['base_term']:
            implicit_facets = self.get_implicit_facets(base_code)
            for imp_facet, imp_desc in implicit_facets:
                # Check if implicit facet is already explicitly provided
                if imp_facet not in seen_facets:
                    result['warnings'].append(
                        f"Term {base_code} has implicit facet {imp_facet}.{imp_desc} that could be made explicit"
                    )
        
        return result
    
    def search_terms(self, query: str, limit: int = 50) -> List[Dict]:
        """Search for terms by name or code"""
        cursor = self.conn.cursor()
        search_pattern = f'%{query}%'
        
        cursor.execute("""
            SELECT DISTINCT
                t.term_code,
                t.extended_name,
                t.common_names,
                t.scientific_names,
                t.term_type,
                t.deprecated,
                GROUP_CONCAT(th.hierarchy_code) as hierarchies
            FROM terms t
            LEFT JOIN term_hierarchies th ON t.term_code = th.term_code
            WHERE (
                t.term_code LIKE ? OR
                LOWER(t.extended_name) LIKE LOWER(?) OR
                LOWER(t.common_names) LIKE LOWER(?) OR
                LOWER(t.scientific_names) LIKE LOWER(?)
            )
            GROUP BY t.term_code
            ORDER BY 
                CASE WHEN t.term_code = ? THEN 0 ELSE 1 END,
                CASE WHEN LOWER(t.extended_name) = LOWER(?) THEN 0 ELSE 1 END,
                t.deprecated,
                t.extended_name
            LIMIT ?
        """, (search_pattern, search_pattern, search_pattern, search_pattern, 
              query, query, limit))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_term_with_hierarchy(self, term_code: str, hierarchy_code: str = 'report') -> Dict:
        """Get full term information including hierarchy context"""
        term = self.get_term(term_code)
        if not term:
            return None
        
        # Add hierarchy information
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                th.*,
                p.extended_name as parent_name
            FROM term_hierarchies th
            LEFT JOIN terms p ON th.parent_code = p.term_code
            WHERE th.term_code = ? AND th.hierarchy_code = ?
        """, (term_code, hierarchy_code))
        
        hierarchy_info = cursor.fetchone()
        if hierarchy_info:
            term['hierarchy_info'] = dict(hierarchy_info)
            term['hierarchy_path'] = self.get_hierarchy_path(term_code, hierarchy_code)
        
        # Add implicit facets
        term['implicit_facets_parsed'] = self.get_implicit_facets(term_code)
        
        return term


def main():
    """Example usage of the FoodEx2Database class"""
    db = FoodEx2Database("/Users/davidfoster/Dev/catalogue-browser/foodex2-validator/data/mtx.db")
    
    print("FoodEx2 Validator Query Examples")
    print("=" * 80)
    
    # Example 1: Validate a simple term
    print("\n1. Validate simple term:")
    result = db.validate_foodex2_code("A01DJ")  # Apples
    print(f"Code: A01DJ")
    print(f"Valid: {result['valid']}")
    print(f"Term: {result['base_term']['extended_name'] if result['base_term'] else 'Not found'}")
    
    # Example 2: Validate term with facets
    print("\n2. Validate term with facets:")
    result = db.validate_foodex2_code("A01DJ#F28.A07JV$F01.A059P")
    print(f"Code: A01DJ#F28.A07JV$F01.A059P")
    print(f"Valid: {result['valid']}")
    if result['errors']:
        print(f"Errors: {result['errors']}")
    if result['warnings']:
        print(f"Warnings: {result['warnings']}")
    
    # Example 3: Search for terms
    print("\n3. Search for apple-related terms:")
    results = db.search_terms("apple", limit=5)
    for term in results:
        print(f"  {term['term_code']} - {term['extended_name']}")
    
    # Example 4: Get facet descriptors
    print("\n4. Get descriptors for Process facet (F28):")
    descriptors = db.get_facet_descriptors("process")[:5]
    for desc in descriptors:
        print(f"  {desc['term_code']} - {desc['extended_name']}")
    
    # Example 5: Get term with hierarchy
    print("\n5. Get term with hierarchy information:")
    term = db.get_term_with_hierarchy("A01DJ", "report")
    if term:
        print(f"Term: {term['term_code']} - {term['extended_name']}")
        print(f"Parent: {term['hierarchy_info']['parent_code']} - {term['hierarchy_info']['parent_name']}")
        print(f"Hierarchy path: {' > '.join(term['hierarchy_path'])}")
    
    db.close()

if __name__ == "__main__":
    main()