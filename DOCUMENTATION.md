# FoodEx2 Validator Documentation

## Overview

This project is a Node.js implementation of the EFSA FoodEx2 code validation system, replicating the functionality of the ICT (Interpreting and Checking Tool). It provides a modern web-based interface and REST API for validating FoodEx2 food classification codes against the complete set of EFSA business rules.

### Key Features

- Complete implementation of all 31 EFSA business rules
- Database-driven validation (no runtime CSV loading)
- Modern web interface with real-time validation
- REST API for integration with other systems
- Batch validation support
- Full compatibility with ICT validation results

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Web Interface<br/>Vite + Vanilla JS]
        API_Client[API Client]
    end
    
    subgraph "API Layer"
        Express[Express.js Server<br/>Port 5001]
        Router[API Router]
        Middleware[Middleware<br/>CORS, Rate Limiting]
    end
    
    subgraph "Service Layer"
        FoodEx2Service[FoodEx2 Service<br/>Orchestration]
        Validator[Validation Engine]
        SearchEngine[Search Engine]
    end
    
    subgraph "Validation Components"
        VBA[VBA Validator<br/>9 Structural Rules]
        BR[Business Rules<br/>31 Rules]
        SR[Soft Rules<br/>Info Level]
        HH[Hierarchy Helper]
    end
    
    subgraph "Data Layer"
        DB[(SQLite Database<br/>MTX v16.3<br/>31,652 terms)]
        Cache[Cache Manager<br/>TTL: 3600s]
    end
    
    UI --> API_Client
    API_Client --> Express
    Express --> Router
    Router --> Middleware
    Middleware --> FoodEx2Service
    
    FoodEx2Service --> Validator
    FoodEx2Service --> SearchEngine
    FoodEx2Service --> Cache
    
    Validator --> VBA
    Validator --> BR
    Validator --> SR
    BR --> HH
    
    FoodEx2Service --> DB
    SearchEngine --> DB
    Cache --> DB
    
    style UI fill:#e1f5fe
    style Express fill:#fff3e0
    style FoodEx2Service fill:#f3e5f5
    style DB fill:#e8f5e9
    style Validator fill:#fce4ec
```

### Technology Stack

```
foodex2-validator/
├── server/                      # Backend application
│   ├── index.js                # Express server setup
│   ├── database-validator.js   # Database-driven validation orchestrator
│   ├── complete-business-rules.js  # All 31 business rules implementation
│   ├── setup-complete-database.js  # Complete database setup with all tables
│   ├── setup-database.js       # Initial database setup
│   └── import-excel.js         # Excel to SQLite converter
├── client/                     # Frontend application
│   ├── src/
│   │   ├── main.js            # Application logic
│   │   └── style.css          # Styling
│   ├── index.html             # Entry point
│   └── vite.config.js         # Vite configuration
├── data/                       # Data files
│   ├── mtx.db                 # SQLite database (31,619 terms)
│   ├── BR_Data.csv            # Forbidden processes definitions
│   ├── warningMessages.txt    # Business rule messages
│   └── warningColors.txt      # UI warning colors
└── Shell scripts              # Automation scripts
    ├── setup.sh               # One-time setup
    ├── start.sh               # Start both servers
    ├── start-backend.sh       # Start backend only
    └── start-frontend.sh      # Start frontend only
```

## Data Flow

### Validation Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant V as Validator
    participant DB as Database
    participant R as Rule Engine
    
    U->>F: Enter FoodEx2 Code
    F->>F: Basic validation
    F->>A: POST /api/validate
    A->>V: validateCode(code, context)
    
    V->>V: Parse code structure
    Note over V: Split base term & facets
    
    V->>DB: Get base term
    DB-->>V: Term details
    
    alt Term not found
        V-->>A: Error: Invalid base term
        A-->>F: Validation failed
        F-->>U: Display error
    else Term exists
        V->>DB: Get facet descriptors
        DB-->>V: Facet details
        
        V->>R: Run VBA rules
        R-->>V: Structural warnings
        
        V->>R: Run business rules
        loop For each business rule
            R->>DB: Query relationships
            DB-->>R: Data
            R->>R: Evaluate rule
        end
        R-->>V: Business warnings
        
        V->>R: Run soft rules
        R-->>V: Info warnings
        
        V->>V: Aggregate results
        V-->>A: Validation result
        A-->>F: JSON response
        F-->>U: Display results
    end
```

### Code Structure Diagram

```mermaid
graph LR
    subgraph "FoodEx2 Code Structure"
        Code[A0B9Z#F28.A07JS$F01.A0EZJ]
        
        Code --> BaseTerm[Base Term<br/>A0B9Z]
        Code --> Separator1[#]
        Code --> Facet1[Facet 1<br/>F28.A07JS]
        Code --> Separator2[$]
        Code --> Facet2[Facet 2<br/>F01.A0EZJ]
        
        Facet1 --> F1Cat[Category<br/>F28]
        Facet1 --> F1Desc[Descriptor<br/>A07JS]
        
        Facet2 --> F2Cat[Category<br/>F01]
        Facet2 --> F2Desc[Descriptor<br/>A0EZJ]
    end
    
    style Code fill:#fff3e0
    style BaseTerm fill:#e3f2fd
    style Facet1 fill:#f3e5f5
    style Facet2 fill:#f3e5f5
```

## Implementation Details

### Database Schema

#### Entity Relationship Diagram

```mermaid
erDiagram
    TERMS ||--o{ TERM_HIERARCHIES : "has"
    TERMS ||--o{ FACETS : "allows"
    FACETS ||--o{ DESCRIPTORS : "contains"
    TERMS }o--|| PROCESS_ORDCODES : "may have"
    PROCESS_ORDCODES ||--o{ FORBIDDEN_PROCESSES : "defines"
    BUSINESS_RULES ||--o{ VALIDATION_WARNINGS : "generates"
    
    TERMS {
        TEXT term_code PK
        TEXT extended_name
        TEXT short_name
        TEXT term_type
        TEXT status
        INTEGER deprecated
        TEXT all_facets
        TEXT implicit_facets
        TEXT parent_code
        TEXT version
    }
    
    TERM_HIERARCHIES {
        TEXT term_code FK
        TEXT hierarchy_code
        TEXT parent_code
        INTEGER order_num
    }
    
    FACETS {
        TEXT facet_code PK
        TEXT facet_header
        TEXT category
        TEXT scope_note
        TEXT facet_type
    }
    
    DESCRIPTORS {
        INTEGER id PK
        TEXT code
        TEXT facet_code FK
        TEXT name
        TEXT type
    }
    
    PROCESS_ORDCODES {
        TEXT process_code PK
        TEXT process_name
        REAL ordinal_code
        TEXT root_group_code
        TEXT root_group_label
    }
    
    FORBIDDEN_PROCESSES {
        INTEGER id PK
        TEXT root_group_code
        TEXT root_group_label
        TEXT forbidden_process_code
        TEXT forbidden_process_label
        REAL ordinal_code
    }
    
    BUSINESS_RULES {
        TEXT rule_id PK
        INTEGER message_id
        TEXT trigger_description
        TEXT message_text
        TEXT semaphore_level
        TEXT text_level
    }
    
    VALIDATION_WARNINGS {
        TEXT rule_id FK
        TEXT warning_message
        TEXT severity
    }
```

The SQLite database (converted from MTX Excel) contains:

```sql
-- Main terms table (31,652 records)
CREATE TABLE terms (
    term_code TEXT PRIMARY KEY,      -- e.g., 'A0B9Z'
    extended_name TEXT,              -- e.g., 'Bovine meat'
    short_name TEXT,
    term_type TEXT,                  -- r=raw, d=derivative, c=composite, etc.
    status TEXT,                     -- APPROVED, DISMISSED, etc.
    deprecated INTEGER DEFAULT 0,
    all_facets TEXT,                -- Allowed facets
    implicit_facets TEXT,           -- Inherited facets
    -- ... additional fields
);

-- Term hierarchy relationships (88,642 records)
CREATE TABLE term_hierarchies (
    term_code TEXT,
    hierarchy_code TEXT,             -- expo, report, master, etc.
    parent_code TEXT,
    order_num INTEGER,
    PRIMARY KEY (term_code, hierarchy_code)
);

-- Process ordinal codes (80 records)
CREATE TABLE process_ordcodes (
    process_code TEXT PRIMARY KEY,
    process_name TEXT,
    ordinal_code REAL NOT NULL,
    root_group_code TEXT,
    root_group_label TEXT
);

-- Forbidden processes (423 records)
CREATE TABLE forbidden_processes (
    id INTEGER PRIMARY KEY,
    root_group_code TEXT NOT NULL,
    root_group_label TEXT,
    forbidden_process_code TEXT NOT NULL,
    forbidden_process_label TEXT,
    ordinal_code REAL
);

-- Business rules (31 records)
CREATE TABLE business_rules (
    rule_id TEXT PRIMARY KEY,
    message_id INTEGER,
    trigger_description TEXT,
    message_text TEXT,
    semaphore_level TEXT,
    text_level TEXT
);
```

### Code Structure

A FoodEx2 code consists of:
- **Base Term**: Primary food item (e.g., `A0B9Z`)
- **Facets**: Additional descriptors (e.g., `F28.A07JS`)
- **Format**: `BASETERM#FACET1#FACET2$FACET3`

### Validation Process

#### Validation State Machine

```mermaid
stateDiagram-v2
    [*] --> Input: User enters code
    
    Input --> StructureCheck: Parse code
    
    StructureCheck --> Invalid: Invalid structure
    StructureCheck --> ParseComponents: Valid structure
    
    Invalid --> [*]: Return error
    
    ParseComponents --> DatabaseLookup: Extract base term & facets
    
    DatabaseLookup --> TermNotFound: No matching term
    DatabaseLookup --> ValidateTerm: Term found
    
    TermNotFound --> [*]: Return error
    
    ValidateTerm --> VBAValidation: Check term status
    
    VBAValidation --> BusinessRules: Run VBA rules
    
    BusinessRules --> SoftRules: Run 31 business rules
    
    SoftRules --> AggregateWarnings: Run soft rules
    
    AggregateWarnings --> CalculateSeverity: Collect all warnings
    
    CalculateSeverity --> DetermineValidity: Determine overall level
    
    DetermineValidity --> Valid: No HIGH warnings
    DetermineValidity --> InvalidWithWarnings: Has HIGH warnings
    
    Valid --> [*]: Return valid result
    InvalidWithWarnings --> [*]: Return invalid with details
```

```javascript
async validate(code) {
    // 1. Structure validation (BR29)
    if (!isValidStructure(code)) return ERROR;
    
    // 2. Parse components
    const { baseTerm, facets } = parseCode(code);
    
    // 3. Database lookup
    const term = await getTerm(baseTerm);
    if (!term) return ERROR;
    
    // 4. Run all business rules
    await checkAllBusinessRules(term, facets, warnings);
    
    // 5. Calculate overall severity
    const overallLevel = calculateOverallLevel(warnings);
    
    return { code, warnings, overallLevel };
}
```

### Business Rules Engine

The complete business rules implementation (`complete-business-rules.js`) includes:

1. **Rule Organization**: Each rule is a separate async method
2. **Database Integration**: Queries for hierarchy relationships, ordinal codes
3. **Facet Parsing**: Handles both `#` and `$` separators
4. **Warning Generation**: Consistent warning format with severity levels

### Key Algorithms

#### Hierarchy Traversal Algorithm

```mermaid
graph TD
    Start[Start: Check Hierarchy]
    Input[Input: term_code, target_parent]
    
    Start --> Input
    Input --> InitCTE[Initialize Recursive CTE]
    
    InitCTE --> BaseCase[Base Case:<br/>SELECT term WHERE code = input]
    BaseCase --> RecursiveCase[Recursive Case:<br/>JOIN parent terms]
    
    RecursiveCase --> CheckParent{Parent = target?}
    CheckParent -->|Yes| Found[Return: Relationship exists]
    CheckParent -->|No| MoreParents{More parents?}
    
    MoreParents -->|Yes| RecursiveCase
    MoreParents -->|No| NotFound[Return: No relationship]
    
    Found --> End[End]
    NotFound --> End
```

**Hierarchy Traversal** (for BR01, BR05, etc.):
```sql
-- Recursive CTE to check parent-child relationships
WITH RECURSIVE ancestors AS (
    SELECT term_code, parent_code FROM term_hierarchies WHERE term_code = ?
    UNION ALL
    SELECT th.term_code, th.parent_code 
    FROM term_hierarchies th
    JOIN ancestors a ON th.term_code = a.parent_code
)
SELECT 1 FROM ancestors WHERE parent_code = ?
```

#### Ordinal Code Processing Flow

```mermaid
flowchart LR
    subgraph "Ordinal Code Rules"
        Input[Process Facets]
        Parse[Parse Facet Codes]
        
        Parse --> GetOrdinal[Get Ordinal Codes]
        GetOrdinal --> CheckZero{Code = 0?}
        
        CheckZero -->|Yes| Exempt[Exempt from checks]
        CheckZero -->|No| CheckDecimal{Has decimal?}
        
        CheckDecimal -->|Yes| SubProcess[Check sub-process rules]
        CheckDecimal -->|No| MainProcess[Check main process rules]
        
        SubProcess --> CheckParent[Verify parent process]
        MainProcess --> CheckExclusive[Check mutual exclusivity]
        
        CheckParent --> Validate
        CheckExclusive --> Validate
        Exempt --> Validate[Generate warnings]
    end
```

**Ordinal Code Checking** (for BR26, BR27):
- Processes with same ordinal code are mutually exclusive
- Decimal codes (1.1, 1.2) indicate sub-processes
- Code 0 is exempt from mutual exclusivity

## Deployment

### Development Setup

1. **Prerequisites**: Node.js 14+, npm
2. **Installation**: `./setup.sh`
3. **Database Setup**: `node server/setup-complete-database.js` (imports all validation data)
4. **Development**: `./start.sh` (includes hot reload)

### Production Deployment

1. **Build Frontend**: `cd client && npm run build`
2. **Environment Variables**:
   ```bash
   PORT=5001
   NODE_ENV=production
   ```
3. **Process Manager**: Use PM2 or similar for production

### API Integration

The validator exposes REST endpoints:

```javascript
// Single validation
POST /api/validate
{
    "code": "A0B9Z#F28.A07JS"
}

// Batch validation
POST /api/validate/batch
{
    "codes": ["A0B9Z", "A0EZS#F01.A0F6E", "A0BXM"]
}

// Response format
{
    "code": "A0B9Z#F28.A07JS",
    "valid": true,
    "baseTerm": {
        "code": "A0B9Z",
        "name": "Bovine meat",
        "type": "r"
    },
    "facets": ["F28.A07JS"],
    "warnings": [{
        "rule": "BR19",
        "message": "Processes that create...",
        "semaphoreLevel": "HIGH",
        "textLevel": "HIGH"
    }],
    "overallLevel": "HIGH",
    "processingTime": 45
}
```

## Performance Considerations

- **Database Indexes**: On term_code, hierarchy_code, process codes for fast lookups
- **No Runtime CSV Loading**: All validation data pre-loaded in database
- **Batch Processing**: Parallel validation for multiple codes
- **Connection Pooling**: Single SQLite connection reused
- **Query Optimization**: Direct SQL queries for all lookups

## Maintenance

### Adding New Business Rules

1. Add rule definition to `warningMessages.txt`
2. Implement method in `complete-business-rules.js`
3. Add call in validator's rule execution sequence
4. Test with known validation cases

### Updating MTX Catalogue

1. Export new MTX Excel to same format
2. Run Python import script or Node.js importer
3. Update CSV files if business rules change
4. Run `node server/setup-complete-database.js` to reimport all data
5. Restart server

### Monitoring

- Health check: `GET /api/health`
- Rule definitions: `GET /api/rules`
- Logs: Uses console logging (can be configured for production)

## Additional Diagrams

### Business Rule Categories

```mermaid
pie title Business Rule Distribution
    "Structural Rules (VBA)" : 9
    "Process Rules" : 8
    "Facet Rules" : 7
    "Hierarchy Rules" : 5
    "Type Rules" : 5
    "Implicit Rules" : 3
    "Other Rules" : 3
```

### API Request/Response Flow

```mermaid
flowchart TB
    subgraph "Client Request"
        Request[HTTP POST /api/validate]
        Body["{<br/>  'code': 'A000J#F01.A07XG',<br/>  'context': 'ICT'<br/>}"]
    end

    subgraph "Server Processing"
        Parse[Parse Request]
        Auth[Check Authorization]
        Validate[Run Validation]
        Format[Format Response]
    end

    subgraph "Response"
        Success["200 OK<br/>{<br/>  'valid': true,<br/>  'warnings': [],<br/>  'baseTerm': {...},<br/>  'facets': [...]<br/>}"]
        Error["400/500 Error<br/>{<br/>  'error': 'message',<br/>  'details': {...}<br/>}"]
    end

    Request --> Body
    Body --> Parse
    Parse --> Auth
    Auth --> Validate
    Validate -->|Success| Format
    Validate -->|Failure| Error
    Format --> Success
```

### Performance Optimization Strategy

```mermaid
graph LR
    subgraph "Optimization Layers"
        Cache[Memory Cache<br/>TTL: 3600s]
        Index[DB Indexes<br/>term_code, hierarchy]
        Pool[Connection Pool<br/>Reuse connections]
        Batch[Batch Processing<br/>Parallel validation]
    end

    subgraph "Performance Metrics"
        Response[Response Time<br/><100ms avg]
        Throughput[Throughput<br/>>100 req/s]
        Memory[Memory Usage<br/><1GB RAM]
        CPU[CPU Usage<br/><50% avg]
    end

    Cache --> Response
    Index --> Response
    Pool --> Throughput
    Batch --> Throughput

    Cache --> Memory
    Pool --> CPU
```

### Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer<br/>Nginx]

        subgraph "Application Servers"
            PM2[PM2 Process Manager]
            Node1[Node Instance 1]
            Node2[Node Instance 2]
            Node3[Node Instance 3]
        end

        subgraph "Data Layer"
            DB[(Primary Database<br/>SQLite)]
            Backup[(Backup Database<br/>Replicated)]
            Cache[Redis Cache<br/>Optional]
        end

        subgraph "Monitoring"
            Logs[Log Aggregation]
            Metrics[Metrics Collection]
            Alerts[Alert System]
        end
    end

    LB --> PM2
    PM2 --> Node1
    PM2 --> Node2
    PM2 --> Node3

    Node1 --> DB
    Node2 --> DB
    Node3 --> DB

    Node1 --> Cache
    Node2 --> Cache
    Node3 --> Cache

    DB --> Backup

    Node1 --> Logs
    Node2 --> Logs
    Node3 --> Logs

    Logs --> Metrics
    Metrics --> Alerts
```

## Quick Reference

### Common FoodEx2 Codes

| Code Type | Example | Description |
|-----------|---------|-------------|
| Base Term Only | `A000J` | Simple food item |
| Single Facet | `A000J#F01.A07XG` | Food with one descriptor |
| Multiple Facets | `A000J#F01.A07XG$F28.A0EZJ` | Multiple descriptors |
| Complex | `A0B9Z#F01.A0F6E$F28.A07JS$F10.A0C7L` | Full classification |

### Severity Levels

| Level | Color | Blocking | Description |
|-------|-------|----------|-------------|
| HIGH | Red | Yes | Critical validation failure |
| MEDIUM | Orange | No | Important warning |
| LOW | Yellow | No | Minor issue |
| INFO | Blue | No | Informational message |

### API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/validate` | Single code validation |
| POST | `/api/validate/batch` | Multiple codes validation |
| POST | `/api/validate/export` | Export validation results |
| GET | `/api/search` | Search terms |
| GET | `/api/term/:code` | Get term details |
| GET | `/api/health` | Health check |
| GET | `/api/rules` | List all rules |
| GET | `/api/database/info` | Database statistics |