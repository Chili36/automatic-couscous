# FoodEx2 Validator

A comprehensive validation service for EFSA's FoodEx2 food classification and description system. This tool validates FoodEx2 codes, provides term search functionality, and offers both API and web interfaces for food classification validation.

## Overview

FoodEx2 is the European Food Safety Authority's (EFSA) standardized food classification and description system. It uses a hierarchical system with facets to describe foods in detail. This validator ensures that FoodEx2 codes conform to the official MTX catalogue standards.

### FoodEx2 Code Format
```
BASE#F01.DESC1$F02.DESC2$F03.DESC3
```
- **BASE**: Base term code (e.g., A01DJ for "Apples")
- **Facets**: F01-F33 representing different characteristics
- **Descriptors**: Terms from specific hierarchies that describe the facet

Example: `A01DJ#F28.A07GH$F01.A05YG` = "Apples, poached, from apple plant"

## Features

- ✅ **Full code validation** against MTX v16.2 catalogue
- 🔍 **Term search** with fuzzy matching
- 📊 **Hierarchy navigation** for exploring food classifications
- 🏷️ **Facet validation** with valid descriptor lookup
- 🌐 **REST API** for integration with other systems
- 💻 **Web interface** for interactive validation
- 📄 **CSV/Excel export** for validation results
- ⚖️ **Soft rule awareness** that separates critical issues from informational warnings
- 📁 **Excel import/export** support
- 🗄️ **SQLite database** with 31,619 official terms
- 📋 **All 31 business rules** (BR01-BR31) from the original ICT

## Quick Start

1. Run the setup script (first time only):
```bash
./setup.sh
```

2. Start the application:
```bash
./start.sh
```

3. Open your browser:
   - Frontend: http://localhost:5178
   - Backend API: http://localhost:5001

## Installation

### Prerequisites
- Node.js (v14 or higher)
- Python 3.7+ (for database management scripts)

### Detailed Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/foodex2-validator.git
cd foodex2-validator
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database (if not already present):
```bash
cd scripts
python import_mtx_to_sqlite.py
cd ..
```

4. Start the server:
```bash
npm start
# Or use the provided scripts:
./start-backend.sh  # Backend only
./start-frontend.sh # Frontend only
```

## API Endpoints

### Validate Single Code
```bash
POST /api/validate
Content-Type: application/json

{
  "code": "A0EZJ#F28.A07KS"
}
```

### Validate Batch
```bash
POST /api/validate/batch
Content-Type: application/json

{
  "codes": ["A0EZJ#F28.A07KS", "A000J", "A0B6F#F01.A0EXJ"]
}
```

### Export Validation Results
```bash
POST /api/validate/export
Content-Type: application/json

{
  "codes": ["A0EZJ#F28.A07KS", "A000J"],
  "format": "csv" # or "xlsx"
}
```

Returns a downloadable CSV (default) or Excel file containing validation outcomes, cleaned codes, interpreted descriptions, and aggregated warnings for each code, including separate columns for soft-rule warnings and informational guidance.

### Search for Terms
```bash
GET /api/search?q=apple&limit=10
```

### Get Facet Descriptors
```bash
GET /api/facets/F28/descriptors
```

### Get Term Details
```bash
GET /api/terms/A01DJ
```

### Get Rules Info
```bash
GET /api/rules
```

Returns metadata for all implemented rules. The response now includes
categorised business rules, including dedicated `softRules` (LOW severity)
and `infoRules` (NONE severity) collections so clients can surface
non-blocking guidance separately from critical validation errors.

## Business Rules Implementation

The validator implements all 31 business rules from the ICT:

- **BR01**: Source commodity validation for raw terms
- **BR03-BR04**: No source facets in composite foods
- **BR05-BR07**: Derivative source restrictions
- **BR08**: Non-reportable terms check
- **BR10**: Non-specific terms warning
- **BR11**: Generic process terms warning
- **BR13**: Physical state creates derivatives
- **BR16**: Process detail level check
- **BR17**: Facets as base terms forbidden
- **BR19**: Forbidden processes on raw commodities
- **BR20-BR21**: Deprecated/dismissed terms
- **BR23-BR24**: Hierarchy term warnings
- **BR25**: Single cardinality check
- **BR26**: Mutually exclusive processes
- **BR27**: Decimal ordcode conflicts
- **BR28**: Reconstitution restrictions
- **BR29-BR31**: Structure and validity checks

## Database Structure

The validator uses an SQLite database (`data/mtx.db`) containing:

- **31,619 terms** - All FoodEx2 food items
- **39 hierarchies** - Classification structures
- **51 attributes** - Facets for describing food characteristics
- **88,642 relationships** - Term-hierarchy mappings

### Key Tables
- `terms` - Main term definitions
- `hierarchies` - Classification hierarchies
- `attributes` - Facet definitions
- `term_hierarchies` - Many-to-many relationships
- `release_notes` - Version history

## Project Structure

```
foodex2-validator/
├── server/
│   ├── index.js           # Express server
│   ├── validator.js       # Core validation logic
│   └── setup-database.js  # Database initialization
├── client/
│   └── index.html         # Web interface
├── src/                   # Additional source code
│   ├── api/              # REST API routes
│   ├── validators/       # Validation logic
│   ├── services/         # Business logic
│   └── utils/            # Helper functions
├── public/               # Web interface static files
├── data/
│   ├── mtx.db           # SQLite database
│   ├── MTX_16.2.xlsx    # Source catalogue
│   ├── BR_Data.csv      # Forbidden processes
│   ├── warningMessages.txt # Rule definitions
│   └── warningColors.txt   # UI colors
├── scripts/              # Python utilities
│   ├── import_mtx_to_sqlite.py
│   ├── query_mtx_database.py
│   ├── foodex2_validator_queries.py
│   └── examine_excel.py
├── tests/                # Test files
└── package.json
```

## Command Line Interface

```bash
# Validate a code
node cli.js validate "A01DJ#F28.A07GH"

# Search for terms
node cli.js search "apple"

# Import Excel file
node cli.js import catalogue.xlsx
```

## Development

### Running tests
```bash
npm test
```

### Development mode with hot reload
```bash
npm run dev
```

### Building for production
```bash
npm run build
```

## Python Scripts

The `scripts/` folder contains utilities for database management:

- `import_mtx_to_sqlite.py` - Import MTX Excel catalogue to SQLite
- `query_mtx_database.py` - Example queries and demonstrations
- `foodex2_validator_queries.py` - Validation logic implementations
- `examine_excel.py` - Analyze Excel structure

## Extending the Validator

To add more validation rules:

1. Add the rule definition to `data/warningMessages.txt`
2. Implement the check in `server/validator.js`
3. Add the rule code to the appropriate validation method
4. Update tests to cover the new rule

## Example Codes for Testing

- Valid base term: `A0EZJ` (Apple)
- With single facet: `A0EZJ#F28.A07KS` (Apple with process)
- Multiple facets: `A0B6F#F01.A0EXJ$F28.A07KS`
- Invalid structure: `INVALID`
- Deprecated term: Check BR20-BR21 rules

## MTX Catalogue Information

- **Version**: 16.2
- **Status**: PUBLISHED MINOR
- **Terms**: 31,619
- **Last Update**: See release notes in database

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Specify your license here]

## Acknowledgments

- European Food Safety Authority (EFSA) for the FoodEx2 system
- Original ICT (Interpreting and Checking Tool) developers
- Original catalogue browser project contributors

## Related Projects

- [EFSA Catalogue Browser](https://github.com/openefsa/catalogue-browser) - Desktop application for browsing EFSA catalogues
- [EFSA Data Collection Framework](https://www.efsa.europa.eu/en/data/data-collection) - Official EFSA data collection system

## Support

For issues and questions, please use the GitHub issue tracker.