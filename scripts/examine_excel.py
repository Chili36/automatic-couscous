#!/usr/bin/env python3
import pandas as pd
import sys

def examine_excel_file(file_path):
    """Examine the structure of the Excel file"""
    print(f"Examining Excel file: {file_path}\n")
    
    # Load the Excel file
    xl_file = pd.ExcelFile(file_path)
    
    # List all sheet names
    print("Available sheets:")
    for i, sheet_name in enumerate(xl_file.sheet_names):
        print(f"  {i+1}. {sheet_name}")
    
    print("\n" + "="*80 + "\n")
    
    # Examine each sheet
    for sheet_name in xl_file.sheet_names:
        print(f"Sheet: {sheet_name}")
        print("-" * 40)
        
        # Read the sheet
        df = pd.read_excel(xl_file, sheet_name=sheet_name)
        
        # Basic info
        print(f"Shape: {df.shape} (rows: {df.shape[0]}, columns: {df.shape[1]})")
        print(f"\nColumn names:")
        for col in df.columns:
            print(f"  - {col} ({df[col].dtype})")
        
        # Show first few rows
        print(f"\nFirst 5 rows:")
        print(df.head())
        
        # Show sample values for each column
        print(f"\nSample values for each column:")
        for col in df.columns:
            non_null_values = df[col].dropna()
            if len(non_null_values) > 0:
                sample_values = non_null_values.head(3).tolist()
                print(f"  {col}: {sample_values}")
        
        print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    examine_excel_file("/Users/davidfoster/Dev/catalogue-browser/MTX_16.2.xlsx")