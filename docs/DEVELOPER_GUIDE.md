# FoodEx2 Code Validator - Developer Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Environment](#development-environment)
3. [Project Structure](#project-structure)
4. [Backend Development](#backend-development)
5. [Frontend Development](#frontend-development)
6. [Database Management](#database-management)
7. [Validation Engine](#validation-engine)
8. [API Development](#api-development)
9. [Testing Strategy](#testing-strategy)
10. [Performance Optimization](#performance-optimization)
11. [Debugging Tips](#debugging-tips)
12. [Common Tasks](#common-tasks)

## Architecture Overview

The FoodEx2 Code Validator follows a traditional client-server architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite)                       │
│                         Port: 5178                           │
├─────────────────────────────────────────────────────────────┤
│                           REST API                           │
├─────────────────────────────────────────────────────────────┤
│                     Backend (Express.js)                     │
│                         Port: 5001                           │
├─────────────────────────────────────────────────────────────┤
│                  FoodEx2 Service Layer                       │
├─────────────────────────────────────────────────────────────┤
│     Validators        │        Database Layer                │
│  ┌──────────────┐    │    ┌─────────────────────┐          │
│  │ VBA Rules    │    │    │  SQLite Database    │          │
│  ├──────────────┤    │    │   MTX v17.0         │          │
│  │Business Rules│    │    │  31,652 terms       │          │
│  ├──────────────┤    │    └─────────────────────┘          │
│  │ Soft Rules   │    │                                      │
│  └──────────────┘    │                                      │
└─────────────────────────────────────────────────────────────┘
```

## Development Environment

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher  
- **SQLite3**: v3.36.0 or higher
- **Git**: v2.30.0 or higher
- **PM2**: v5.3.0 or higher (for production testing)

### Initial Setup

1. **Clone the repository**:
```bash
git clone https://github.com/Chili36/automatic-couscous.git
cd automatic-couscous
```

2. **Install dependencies**:
```bash
# Root dependencies
npm install

# Frontend dependencies
cd client
npm install
cd ..
```

3. **Environment configuration**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database setup** (if not already present):
```bash
node server/setup-database.js
```

5. **Verify installation**:
```bash
# Run health check
curl http://localhost:5001/api/health
```

### Development Scripts

```bash
# Start backend development server with nodemon
npm run dev:backend

# Start frontend development server
npm run dev:frontend

# Start both servers concurrently
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Build frontend for production
npm run build
```

## Project Structure

```
automatic-couscous/
├── client/                      # Frontend application
│   ├── src/
│   │   ├── js/
│   │   │   ├── api.js          # API client
│   │   │   ├── validator.js    # Client-side validation
│   │   │   └── search.js       # Search functionality
│   │   ├── css/
│   │   │   └── styles.css      # Application styles
│   │   └── index.html          # Main HTML file
│   ├── public/                 # Static assets
│   └── vite.config.js          # Vite configuration
│
├── server/                     # Backend application
│   ├── index.js               # Express server entry point
│   ├── database.js            # Database connection and queries
│   ├── foodex2-service.js    # Main service orchestration
│   ├── validators/            # Validation modules
│   │   ├── vba-validator.js  # VBA structural rules
│   │   ├── business-rules-validator.js
│   │   ├── soft-rules-validator.js
│   │   └── hierarchy-helper.js
│   └── import-excel.js       # Excel import utilities
│
├── data/                      # Data files
│   ├── mtx.db                # SQLite database
│   ├── business-rules.json   # Rule definitions
│   └── forbidden-processes.json
│
├── test/                      # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test data
│
├── docs/                     # Documentation
├── scripts/                  # Utility scripts
└── logs/                     # Application logs
```

## Backend Development

### Express Server Setup

The main server file (`server/index.js`) initializes:

```javascript
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Initialize service
const foodex2Service = new FoodEx2Service();
await foodex2Service.initialize();
app.locals.foodex2Service = foodex2Service;

// Routes
app.post('/api/validate', validateHandler);
app.post('/api/validate/batch', batchValidateHandler);
// ... more routes
```

### Service Layer

The `FoodEx2Service` class orchestrates all operations:

```javascript
class FoodEx2Service {
    constructor() {
        this.db = new Database();
        this.validator = new Validator();
        this.searchEngine = new SearchEngine();
    }

    async initialize() {
        await this.db.connect();
        await this.validator.loadRules();
        await this.searchEngine.buildIndex();
    }

    async validateCode(code, options = {}) {
        // Validation orchestration
        const cleaned = this.cleanCode(code);
        const baseTerm = await this.db.getBaseTerm(cleaned);
        const facets = this.parseFacets(cleaned);
        
        return this.validator.validate({
            code: cleaned,
            baseTerm,
            facets,
            context: options.context
        });
    }
}
```

### Error Handling

Implement consistent error handling:

```javascript
class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
    }
}

// Middleware for error handling
app.use((err, req, res, next) => {
    logger.error(err);
    
    if (err instanceof ValidationError) {
        return res.status(400).json({
            error: err.code,
            message: err.message
        });
    }
    
    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
    });
});
```

## Frontend Development

### Vite Configuration

The frontend uses Vite for fast development:

```javascript
// client/vite.config.js
export default {
    server: {
        port: 5178,
        proxy: {
            '/api': {
                target: 'http://localhost:5001',
                changeOrigin: true
            }
        }
    }
};
```

### API Client

Centralized API communication:

```javascript
// client/src/js/api.js
class FoodEx2API {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }

    async validate(code) {
        const response = await fetch(`${this.baseURL}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        return response.json();
    }
}
```

### State Management

Simple state management pattern:

```javascript
class AppState {
    constructor() {
        this.validationResults = [];
        this.currentTab = 'validate';
        this.listeners = [];
    }

    setState(updates) {
        Object.assign(this, updates);
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this));
    }
}
```

## Database Management

### Schema Overview

```sql
-- Main tables
CREATE TABLE terms (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    scientific_name TEXT,
    scope_note TEXT,
    parent_code TEXT,
    version TEXT,
    term_type TEXT,
    state TEXT,
    last_update TEXT
);

CREATE TABLE hierarchy (
    id INTEGER PRIMARY KEY,
    child_code TEXT,
    parent_code TEXT,
    level INTEGER,
    FOREIGN KEY (child_code) REFERENCES terms(code),
    FOREIGN KEY (parent_code) REFERENCES terms(code)
);

CREATE TABLE facets (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    header TEXT,
    category TEXT,
    scope_note TEXT,
    type TEXT
);

CREATE TABLE descriptors (
    id INTEGER PRIMARY KEY,
    code TEXT,
    facet_code TEXT,
    name TEXT,
    type TEXT,
    FOREIGN KEY (facet_code) REFERENCES facets(code)
);

-- Indexes for performance
CREATE INDEX idx_terms_name ON terms(name);
CREATE INDEX idx_terms_parent ON terms(parent_code);
CREATE INDEX idx_hierarchy_child ON hierarchy(child_code);
CREATE INDEX idx_hierarchy_parent ON hierarchy(parent_code);
CREATE INDEX idx_descriptors_facet ON descriptors(facet_code);
```

### Database Operations

```javascript
class Database {
    async getBaseTerm(code) {
        return this.db.get(`
            SELECT * FROM terms 
            WHERE code = ? AND type = 'baseterm'
        `, [code]);
    }

    async searchTerms(query, limit = 50) {
        return this.db.all(`
            SELECT * FROM terms
            WHERE name LIKE ? OR code LIKE ?
            ORDER BY 
                CASE 
                    WHEN code = ? THEN 0
                    WHEN code LIKE ? THEN 1
                    WHEN name LIKE ? THEN 2
                    ELSE 3
                END
            LIMIT ?
        `, [`%${query}%`, `%${query}%`, query, `${query}%`, `${query}%`, limit]);
    }

    async getHierarchyPath(code) {
        return this.db.all(`
            WITH RECURSIVE ancestors AS (
                SELECT t.code, t.name, t.parent_code, 0 as level
                FROM terms t
                WHERE t.code = ?
                
                UNION ALL
                
                SELECT t.code, t.name, t.parent_code, a.level + 1
                FROM terms t
                JOIN ancestors a ON t.code = a.parent_code
            )
            SELECT * FROM ancestors ORDER BY level DESC
        `, [code]);
    }
}
```

## Validation Engine

### VBA Validator

Structural validation rules:

```javascript
class VBAValidator {
    validate(code) {
        const warnings = [];
        
        // Rule 1: Check base term format
        if (!this.isValidBaseTermFormat(code)) {
            warnings.push({
                ruleId: 'VBA001',
                message: 'Invalid base term format',
                severity: 'HIGH'
            });
        }
        
        // Rule 2: Check facet structure
        if (code.includes('#')) {
            const facetPart = code.split('#')[1];
            if (!this.isValidFacetStructure(facetPart)) {
                warnings.push({
                    ruleId: 'VBA002',
                    message: 'Invalid facet structure',
                    severity: 'HIGH'
                });
            }
        }
        
        return warnings;
    }
}
```

### Business Rules Validator

Complex business logic validation:

```javascript
class BusinessRulesValidator {
    constructor(rulesConfig) {
        this.rules = this.loadRules(rulesConfig);
    }

    async validate(context) {
        const warnings = [];
        
        for (const rule of this.rules) {
            if (await this.shouldApplyRule(rule, context)) {
                const result = await this.executeRule(rule, context);
                if (result) {
                    warnings.push(result);
                }
            }
        }
        
        return warnings;
    }

    async executeRule(rule, context) {
        switch(rule.type) {
            case 'forbidden_process':
                return this.checkForbiddenProcess(rule, context);
            case 'implicit_facet':
                return this.checkImplicitFacet(rule, context);
            case 'mandatory_facet':
                return this.checkMandatoryFacet(rule, context);
            // ... more rule types
        }
    }
}
```

## API Development

### Request Validation

Use middleware for input validation:

```javascript
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                details: error.details
            });
        }
        next();
    };
};

// Usage
app.post('/api/validate', 
    validateRequest(Joi.object({
        code: Joi.string().required(),
        context: Joi.string().valid('ICT', 'MONITORING')
    })),
    validateHandler
);
```

### Response Formatting

Consistent response structure:

```javascript
class ResponseFormatter {
    static success(data) {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString()
        };
    }

    static error(message, code = 'ERROR', details = null) {
        return {
            success: false,
            error: {
                code,
                message,
                details
            },
            timestamp: new Date().toISOString()
        };
    }

    static paginated(items, page, limit, total) {
        return {
            success: true,
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            timestamp: new Date().toISOString()
        };
    }
}
```

## Testing Strategy

### Unit Testing

```javascript
// test/unit/validator.test.js
describe('FoodEx2 Validator', () => {
    let validator;
    
    beforeEach(() => {
        validator = new Validator();
    });
    
    describe('validateCode', () => {
        it('should accept valid base term', async () => {
            const result = await validator.validateCode('A000J');
            expect(result.valid).toBe(true);
            expect(result.warnings).toHaveLength(0);
        });
        
        it('should reject invalid format', async () => {
            const result = await validator.validateCode('INVALID');
            expect(result.valid).toBe(false);
            expect(result.warnings).toContainEqual(
                expect.objectContaining({
                    ruleId: 'VBA001'
                })
            );
        });
    });
});
```

### Integration Testing

```javascript
// test/integration/api.test.js
describe('API Integration', () => {
    let app;
    
    beforeAll(async () => {
        app = await createTestApp();
    });
    
    describe('POST /api/validate', () => {
        it('should validate a code', async () => {
            const response = await request(app)
                .post('/api/validate')
                .send({ code: 'A000J#F01.A07XG' });
                
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid');
            expect(response.body).toHaveProperty('warnings');
        });
    });
});
```

## Performance Optimization

### Caching Strategy

Implement caching for frequently accessed data:

```javascript
class CacheManager {
    constructor(ttl = 3600) {
        this.cache = new Map();
        this.ttl = ttl * 1000; // Convert to ms
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            expires: Date.now() + this.ttl
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
}

// Use in service
class FoodEx2Service {
    constructor() {
        this.cache = new CacheManager(3600);
    }

    async getTermDetails(code) {
        const cached = this.cache.get(`term:${code}`);
        if (cached) return cached;
        
        const term = await this.db.getTermDetails(code);
        this.cache.set(`term:${code}`, term);
        return term;
    }
}
```

### Database Optimization

```javascript
// Use prepared statements
class Database {
    constructor() {
        this.statements = {};
    }

    async prepare() {
        this.statements.getTerm = await this.db.prepare(
            'SELECT * FROM terms WHERE code = ?'
        );
        this.statements.searchTerms = await this.db.prepare(
            'SELECT * FROM terms WHERE name LIKE ? LIMIT ?'
        );
    }

    async getTermFast(code) {
        return this.statements.getTerm.get(code);
    }
}
```

## Debugging Tips

### Logging Strategy

```javascript
// Use structured logging
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Log with context
logger.info('Validation started', { 
    code, 
    context, 
    requestId 
});
```

### Debug Mode

Enable detailed debugging:

```javascript
// .env
DEBUG=foodex2:*
VERBOSE_LOGGING=true
LOG_SQL_QUERIES=true

// In code
const debug = require('debug')('foodex2:validator');

debug('Processing code: %s', code);
debug('Facets found: %O', facets);
```

### Performance Profiling

```javascript
class PerformanceMonitor {
    start(label) {
        console.time(label);
        return () => console.timeEnd(label);
    }

    async measure(label, fn) {
        const start = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - start;
            logger.info(`Performance: ${label}`, { duration });
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            logger.error(`Performance: ${label} failed`, { duration, error });
            throw error;
        }
    }
}
```

## Common Tasks

### Adding a New Validation Rule

1. Define the rule in configuration:
```json
{
    "id": "BR032",
    "name": "New validation rule",
    "message": "Rule violation message",
    "severity": "MEDIUM",
    "trigger": "facet_combination"
}
```

2. Implement the validator:
```javascript
class NewRuleValidator {
    validate(context) {
        // Implementation
        if (conditionMet) {
            return {
                ruleId: 'BR032',
                message: this.getMessage(context),
                severity: 'MEDIUM'
            };
        }
        return null;
    }
}
```

3. Register with the validation engine:
```javascript
validatorEngine.registerRule('BR032', new NewRuleValidator());
```

### Adding a New API Endpoint

1. Define the route:
```javascript
app.get('/api/statistics', statisticsHandler);
```

2. Implement the handler:
```javascript
async function statisticsHandler(req, res) {
    try {
        const stats = await req.app.locals.foodex2Service.getStatistics();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
```

3. Update OpenAPI documentation:
```yaml
/statistics:
  get:
    summary: Get validation statistics
    responses:
      '200':
        description: Statistics data
```

### Database Migration

1. Create migration file:
```javascript
// migrations/001_add_validation_log.js
exports.up = async (db) => {
    await db.run(`
        CREATE TABLE validation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            result TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

exports.down = async (db) => {
    await db.run('DROP TABLE validation_log');
};
```

2. Run migration:
```bash
node scripts/migrate.js up
```

## Best Practices

1. **Always validate input** at the API boundary
2. **Use transactions** for multi-step database operations
3. **Implement proper error boundaries** in the frontend
4. **Cache expensive operations** but invalidate appropriately
5. **Log important events** with sufficient context
6. **Write tests first** for new features
7. **Document complex business logic** inline
8. **Use TypeScript definitions** for better IDE support
9. **Profile performance** regularly
10. **Keep dependencies updated** but test thoroughly

## Troubleshooting

### Common Issues

**Issue**: Database locked error
```bash
# Solution: Ensure single writer, use WAL mode
sqlite3 mtx.db "PRAGMA journal_mode=WAL;"
```

**Issue**: Memory leak in production
```javascript
// Solution: Clear caches periodically
setInterval(() => {
    cache.clear();
    global.gc && global.gc();
}, 3600000);
```

**Issue**: Slow search queries
```sql
-- Solution: Add appropriate indexes
CREATE INDEX idx_terms_name_lower ON terms(LOWER(name));
ANALYZE;
```

## Resources

- [FoodEx2 Official Documentation](https://www.efsa.europa.eu/en/data/data-standardisation)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [SQLite Optimization](https://www.sqlite.org/optoverview.html)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)