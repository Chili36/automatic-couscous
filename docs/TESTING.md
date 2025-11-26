# FoodEx2 Code Validator - Testing Guide

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Structure](#test-structure)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Performance Testing](#performance-testing)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration](#continuous-integration)
10. [Testing Best Practices](#testing-best-practices)
11. [Troubleshooting](#troubleshooting)

## Testing Philosophy

The FoodEx2 Code Validator follows a comprehensive testing strategy:

- **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E tests
- **Test Coverage**: Minimum 80% code coverage, 100% for critical paths
- **Test Independence**: Tests should not depend on execution order
- **Fast Feedback**: Unit tests < 100ms, integration tests < 1s
- **Meaningful Assertions**: Test behavior, not implementation

## Test Environment Setup

### Prerequisites

```bash
# Install testing dependencies
npm install --save-dev \
    jest \
    @jest/globals \
    supertest \
    sqlite3 \
    jest-environment-jsdom \
    @testing-library/jest-dom \
    cross-env
```

### Configuration

Create `jest.config.js`:

```javascript
module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        'client/src/**/*.js',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/coverage/**'
    ],
    testMatch: [
        '**/test/**/*.test.js',
        '**/test/**/*.spec.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/server/$1',
        '^@client/(.*)$': '<rootDir>/client/src/$1'
    },
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    }
};
```

### Test Setup File

Create `test/setup.js`:

```javascript
// Global test setup
const path = require('path');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.PORT = 0; // Random port

// Global test utilities
global.testUtils = {
    createTestDatabase: require('./utils/database'),
    createTestServer: require('./utils/server'),
    fixtures: require('./fixtures')
};

// Clean up after all tests
afterAll(async () => {
    // Close database connections
    // Clean temporary files
    // Reset mocks
});
```

## Test Structure

```
test/
├── unit/                      # Unit tests
│   ├── validators/
│   │   ├── vba-validator.test.js
│   │   ├── business-rules.test.js
│   │   └── soft-rules.test.js
│   ├── services/
│   │   ├── foodex2-service.test.js
│   │   └── database.test.js
│   └── utils/
│       └── helpers.test.js
├── integration/              # Integration tests
│   ├── api/
│   │   ├── validate.test.js
│   │   ├── search.test.js
│   │   └── export.test.js
│   └── database/
│       └── queries.test.js
├── e2e/                     # End-to-end tests
│   ├── validation-flow.test.js
│   └── batch-processing.test.js
├── performance/             # Performance tests
│   └── load-testing.js
├── fixtures/               # Test data
│   ├── valid-codes.json
│   ├── invalid-codes.json
│   └── database-seed.sql
└── utils/                  # Test utilities
    ├── database.js
    ├── server.js
    └── helpers.js
```

## Unit Testing

### Testing Validators

```javascript
// test/unit/validators/vba-validator.test.js
const VBAValidator = require('@/validators/vba-validator');

describe('VBA Validator', () => {
    let validator;

    beforeEach(() => {
        validator = new VBAValidator();
    });

    describe('Base Term Validation', () => {
        test('should accept valid base term format', () => {
            const result = validator.validateBaseTerm('A000J');
            expect(result.valid).toBe(true);
            expect(result.warnings).toHaveLength(0);
        });

        test('should reject invalid base term format', () => {
            const result = validator.validateBaseTerm('INVALID');
            expect(result.valid).toBe(false);
            expect(result.warnings).toContainEqual(
                expect.objectContaining({
                    ruleId: 'VBA001',
                    severity: 'HIGH'
                })
            );
        });

        test('should handle empty input', () => {
            const result = validator.validateBaseTerm('');
            expect(result.valid).toBe(false);
            expect(result.warnings).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('empty')
                })
            );
        });
    });

    describe('Facet Validation', () => {
        test('should validate correct facet structure', () => {
            const result = validator.validateFacets('A000J#F01.A07XG');
            expect(result.valid).toBe(true);
        });

        test('should detect duplicate facet categories', () => {
            const result = validator.validateFacets('A000J#F01.A07XG$F01.A0EZJ');
            expect(result.warnings).toContainEqual(
                expect.objectContaining({
                    ruleId: 'VBA003',
                    message: expect.stringContaining('duplicate')
                })
            );
        });

        test('should validate facet descriptor format', () => {
            const testCases = [
                { input: 'A000J#F01.INVALID', expected: false },
                { input: 'A000J#F01.A07XG', expected: true },
                { input: 'A000J#F.A07XG', expected: false }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = validator.validateFacets(input);
                expect(result.valid).toBe(expected);
            });
        });
    });
});
```

### Testing Services

```javascript
// test/unit/services/foodex2-service.test.js
const FoodEx2Service = require('@/foodex2-service');
const Database = require('@/database');

jest.mock('@/database');

describe('FoodEx2 Service', () => {
    let service;
    let mockDb;

    beforeEach(() => {
        mockDb = {
            getBaseTerm: jest.fn(),
            getFacet: jest.fn(),
            searchTerms: jest.fn()
        };
        Database.mockImplementation(() => mockDb);
        service = new FoodEx2Service();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateCode', () => {
        test('should validate code with base term only', async () => {
            mockDb.getBaseTerm.mockResolvedValue({
                code: 'A000J',
                name: 'Mammals and birds meat',
                type: 'baseterm'
            });

            const result = await service.validateCode('A000J');
            
            expect(result.valid).toBe(true);
            expect(result.baseTerm).toMatchObject({
                code: 'A000J',
                name: 'Mammals and birds meat'
            });
            expect(mockDb.getBaseTerm).toHaveBeenCalledWith('A000J');
        });

        test('should handle non-existent base term', async () => {
            mockDb.getBaseTerm.mockResolvedValue(null);

            const result = await service.validateCode('XXXXX');
            
            expect(result.valid).toBe(false);
            expect(result.warnings).toContainEqual(
                expect.objectContaining({
                    message: expect.stringContaining('not found')
                })
            );
        });

        test('should validate code with facets', async () => {
            mockDb.getBaseTerm.mockResolvedValue({
                code: 'A000J',
                name: 'Test term'
            });
            mockDb.getFacet.mockResolvedValue({
                code: 'F01',
                header: 'Source'
            });

            const result = await service.validateCode('A000J#F01.A07XG');
            
            expect(result.facets).toHaveLength(1);
            expect(result.facets[0]).toMatchObject({
                code: 'F01',
                descriptor: 'A07XG'
            });
        });
    });

    describe('searchTerms', () => {
        test('should search by term name', async () => {
            const mockResults = [
                { code: 'A000J', name: 'Apple', score: 0.9 },
                { code: 'A000K', name: 'Apple juice', score: 0.8 }
            ];
            mockDb.searchTerms.mockResolvedValue(mockResults);

            const results = await service.searchTerms('apple');
            
            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Apple');
            expect(mockDb.searchTerms).toHaveBeenCalledWith('apple', expect.any(Object));
        });

        test('should limit search results', async () => {
            mockDb.searchTerms.mockResolvedValue([]);

            await service.searchTerms('test', { limit: 10 });
            
            expect(mockDb.searchTerms).toHaveBeenCalledWith('test', 
                expect.objectContaining({ limit: 10 })
            );
        });
    });
});
```

### Testing Utilities

```javascript
// test/unit/utils/helpers.test.js
const { cleanCode, parseFacets, formatWarning } = require('@/utils/helpers');

describe('Helper Functions', () => {
    describe('cleanCode', () => {
        test('should remove whitespace', () => {
            expect(cleanCode(' A000J ')).toBe('A000J');
            expect(cleanCode('A000J # F01.A07XG')).toBe('A000J#F01.A07XG');
        });

        test('should convert to uppercase', () => {
            expect(cleanCode('a000j')).toBe('A000J');
        });

        test('should handle special characters', () => {
            expect(cleanCode('A000J#F01.A07XG$F02.A0EZJ')).toBe('A000J#F01.A07XG$F02.A0EZJ');
        });
    });

    describe('parseFacets', () => {
        test('should parse single facet', () => {
            const facets = parseFacets('A000J#F01.A07XG');
            expect(facets).toHaveLength(1);
            expect(facets[0]).toEqual({
                category: 'F01',
                descriptor: 'A07XG'
            });
        });

        test('should parse multiple facets', () => {
            const facets = parseFacets('A000J#F01.A07XG$F02.A0EZJ');
            expect(facets).toHaveLength(2);
        });

        test('should handle no facets', () => {
            const facets = parseFacets('A000J');
            expect(facets).toHaveLength(0);
        });
    });
});
```

## Integration Testing

### API Integration Tests

```javascript
// test/integration/api/validate.test.js
const request = require('supertest');
const app = require('@/index');
const { createTestDatabase } = require('../../utils/database');

describe('POST /api/validate', () => {
    let server;
    let db;

    beforeAll(async () => {
        db = await createTestDatabase();
        server = app.listen(0);
    });

    afterAll(async () => {
        await server.close();
        await db.close();
    });

    test('should validate a correct code', async () => {
        const response = await request(server)
            .post('/api/validate')
            .send({ code: 'A000J' })
            .expect(200);

        expect(response.body).toMatchObject({
            code: 'A000J',
            valid: true,
            warnings: []
        });
    });

    test('should return 400 for missing code', async () => {
        const response = await request(server)
            .post('/api/validate')
            .send({})
            .expect(400);

        expect(response.body.error).toBe('Code is required');
    });

    test('should validate code with context', async () => {
        const response = await request(server)
            .post('/api/validate')
            .send({ 
                code: 'A000J#F01.A07XG',
                context: 'MONITORING'
            })
            .expect(200);

        expect(response.body.valid).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
        // Simulate database error
        await db.close();

        const response = await request(server)
            .post('/api/validate')
            .send({ code: 'A000J' })
            .expect(500);

        expect(response.body.error).toBe('Validation failed');
    });
});
```

### Database Integration Tests

```javascript
// test/integration/database/queries.test.js
const Database = require('@/database');
const { seedTestData } = require('../../utils/database');

describe('Database Queries', () => {
    let db;

    beforeAll(async () => {
        db = new Database(':memory:');
        await db.initialize();
        await seedTestData(db);
    });

    afterAll(async () => {
        await db.close();
    });

    describe('Term Queries', () => {
        test('should retrieve term by code', async () => {
            const term = await db.getTermByCode('A000J');
            
            expect(term).toBeDefined();
            expect(term.code).toBe('A000J');
            expect(term.name).toBeDefined();
        });

        test('should get term hierarchy', async () => {
            const hierarchy = await db.getHierarchy('A000J');
            
            expect(hierarchy).toBeInstanceOf(Array);
            expect(hierarchy.length).toBeGreaterThan(0);
        });

        test('should search terms efficiently', async () => {
            const start = Date.now();
            const results = await db.searchTerms('apple', 100);
            const duration = Date.now() - start;
            
            expect(results).toBeInstanceOf(Array);
            expect(duration).toBeLessThan(100); // Should be fast
        });
    });

    describe('Facet Queries', () => {
        test('should retrieve facet details', async () => {
            const facet = await db.getFacet('F01');
            
            expect(facet).toBeDefined();
            expect(facet.header).toBeDefined();
        });

        test('should get descriptors for facet', async () => {
            const descriptors = await db.getDescriptors('F01');
            
            expect(descriptors).toBeInstanceOf(Array);
            expect(descriptors.length).toBeGreaterThan(0);
        });
    });

    describe('Transaction Support', () => {
        test('should rollback on error', async () => {
            const initialCount = await db.getTermCount();
            
            try {
                await db.transaction(async (trx) => {
                    await trx.run('INSERT INTO terms (code, name) VALUES (?, ?)', 
                        ['TEST1', 'Test 1']);
                    throw new Error('Rollback test');
                });
            } catch (error) {
                // Expected
            }
            
            const finalCount = await db.getTermCount();
            expect(finalCount).toBe(initialCount);
        });
    });
});
```

## End-to-End Testing

### Complete Validation Flow

```javascript
// test/e2e/validation-flow.test.js
const puppeteer = require('puppeteer');

describe('E2E: Validation Flow', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        page = await browser.newPage();
    });

    afterAll(async () => {
        await browser.close();
    });

    test('should validate a code through UI', async () => {
        await page.goto('http://localhost:5178');
        
        // Enter code
        await page.type('#code-input', 'A000J#F01.A07XG');
        
        // Click validate
        await page.click('#validate-btn');
        
        // Wait for results
        await page.waitForSelector('.validation-result');
        
        // Check result
        const resultText = await page.$eval('.validation-result', 
            el => el.textContent);
        expect(resultText).toContain('Valid');
    });

    test('should display warnings for invalid code', async () => {
        await page.goto('http://localhost:5178');
        
        await page.type('#code-input', 'INVALID');
        await page.click('#validate-btn');
        
        await page.waitForSelector('.warning-message');
        
        const warnings = await page.$$eval('.warning-message', 
            elements => elements.map(el => el.textContent));
        expect(warnings.length).toBeGreaterThan(0);
    });

    test('should export results', async () => {
        await page.goto('http://localhost:5178');
        
        // Validate multiple codes
        await page.click('#batch-mode');
        await page.type('#codes-textarea', 'A000J\nA000K\nA000L');
        await page.click('#validate-batch-btn');
        
        // Wait for results
        await page.waitForSelector('.batch-results');
        
        // Export as CSV
        const downloadPromise = page.waitForEvent('download');
        await page.click('#export-csv');
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toContain('.csv');
    });
});
```

### Batch Processing Test

```javascript
// test/e2e/batch-processing.test.js
describe('E2E: Batch Processing', () => {
    test('should process large batch efficiently', async () => {
        const codes = generateTestCodes(1000);
        
        const startTime = Date.now();
        const response = await fetch('http://localhost:5001/api/validate/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes })
        });
        const duration = Date.now() - startTime;
        
        expect(response.ok).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5s
        
        const data = await response.json();
        expect(data.results).toHaveLength(1000);
        expect(data.statistics).toBeDefined();
    });
});
```

## Performance Testing

### Load Testing

```javascript
// test/performance/load-testing.js
const autocannon = require('autocannon');

async function runLoadTest() {
    const result = await autocannon({
        url: 'http://localhost:5001',
        connections: 10,
        pipelining: 1,
        duration: 30,
        requests: [
            {
                method: 'POST',
                path: '/api/validate',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: 'A000J#F01.A07XG' })
            }
        ]
    });

    console.log('Load Test Results:');
    console.log(`Requests/sec: ${result.requests.average}`);
    console.log(`Latency (ms): ${result.latency.average}`);
    console.log(`Errors: ${result.errors}`);
    
    // Assert performance requirements
    expect(result.requests.average).toBeGreaterThan(100); // >100 req/s
    expect(result.latency.p99).toBeLessThan(1000); // <1s 99th percentile
    expect(result.errors).toBe(0);
}

if (require.main === module) {
    runLoadTest().catch(console.error);
}
```

### Memory Leak Detection

```javascript
// test/performance/memory-leak.js
const memwatch = require('memwatch-next');

describe('Memory Leak Detection', () => {
    test('should not leak memory during repeated validations', (done) => {
        let leakDetected = false;
        
        const hd = new memwatch.HeapDiff();
        
        memwatch.on('leak', (info) => {
            leakDetected = true;
            console.error('Memory leak detected:', info);
        });

        // Perform many operations
        const promises = [];
        for (let i = 0; i < 10000; i++) {
            promises.push(
                service.validateCode(`A000J#F01.A07XG`)
            );
        }

        Promise.all(promises).then(() => {
            const diff = hd.end();
            
            // Check memory growth
            expect(leakDetected).toBe(false);
            expect(diff.change.size_bytes).toBeLessThan(10 * 1024 * 1024); // <10MB growth
            
            done();
        });
    }, 60000);
});
```

## Test Data Management

### Fixtures

```javascript
// test/fixtures/index.js
module.exports = {
    validCodes: [
        'A000J',
        'A000J#F01.A07XG',
        'A000K#F20.A07KS$F01.A0EZJ',
        // ... more test codes
    ],
    
    invalidCodes: [
        'INVALID',
        'A000J#INVALID',
        'A000J#F01.XXXXX',
        // ... more invalid codes
    ],
    
    edgeCases: [
        '',
        'A',
        'A000J' + '#F01.A07XG'.repeat(100), // Very long code
        'A000J#F01.A07XG$F01.A07XG', // Duplicate facets
        // ... more edge cases
    ],
    
    businessRuleViolations: {
        'BR001': 'A000J#F27.A0EZJ', // Forbidden process
        'BR002': 'A000K#F01.A07XG', // Incompatible facet
        // ... mapped to specific rule violations
    }
};
```

### Database Seeding

```javascript
// test/utils/database.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function createTestDatabase() {
    const db = await open({
        filename: ':memory:',
        driver: sqlite3.Database
    });

    // Create schema
    await db.exec(`
        CREATE TABLE terms (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            parent_code TEXT
        );
        
        CREATE TABLE facets (
            code TEXT PRIMARY KEY,
            header TEXT,
            category TEXT
        );
        
        CREATE TABLE descriptors (
            id INTEGER PRIMARY KEY,
            code TEXT,
            facet_code TEXT,
            name TEXT
        );
    `);

    // Seed test data
    await seedTestData(db);
    
    return db;
}

async function seedTestData(db) {
    // Insert test terms
    const terms = [
        ['A000J', 'Mammals and birds meat', 'baseterm', null],
        ['A000K', 'Fish meat', 'baseterm', null],
        ['A07XG', 'Chicken', 'descriptor', null]
    ];
    
    for (const term of terms) {
        await db.run(
            'INSERT INTO terms (code, name, type, parent_code) VALUES (?, ?, ?, ?)',
            term
        );
    }
    
    // Insert test facets
    await db.run(
        'INSERT INTO facets (code, header, category) VALUES (?, ?, ?)',
        ['F01', 'Source', 'SOURCE']
    );
}

module.exports = { createTestDatabase, seedTestData };
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Performance tests
        run: npm run test:performance
        if: github.event_name == 'pull_request'
```

## Testing Best Practices

### 1. Test Organization

```javascript
// Good: Clear test structure
describe('Component/Module Name', () => {
    describe('Method/Feature Name', () => {
        it('should do specific behavior', () => {
            // Arrange
            const input = setupTestData();
            
            // Act
            const result = executeFunction(input);
            
            // Assert
            expect(result).toMatchExpectedOutput();
        });
    });
});
```

### 2. Test Isolation

```javascript
// Good: Isolated tests
beforeEach(() => {
    // Reset state
    jest.clearAllMocks();
    database.reset();
});

afterEach(() => {
    // Clean up
    server.close();
});
```

### 3. Meaningful Assertions

```javascript
// Bad
expect(result).toBeTruthy();

// Good
expect(result.valid).toBe(true);
expect(result.warnings).toHaveLength(0);
expect(result.baseTerm.code).toBe('A000J');
```

### 4. Test Data Builders

```javascript
class CodeBuilder {
    constructor() {
        this.code = 'A000J';
        this.facets = [];
    }

    withFacet(category, descriptor) {
        this.facets.push({ category, descriptor });
        return this;
    }

    build() {
        let result = this.code;
        if (this.facets.length > 0) {
            result += '#' + this.facets
                .map(f => `${f.category}.${f.descriptor}`)
                .join('$');
        }
        return result;
    }
}

// Usage
const code = new CodeBuilder()
    .withFacet('F01', 'A07XG')
    .withFacet('F02', 'A0EZJ')
    .build();
```

### 5. Async Testing

```javascript
// Good: Proper async testing
test('should handle async operations', async () => {
    const result = await service.validateCode('A000J');
    expect(result).toBeDefined();
});

// With error handling
test('should handle async errors', async () => {
    await expect(service.validateCode('INVALID'))
        .rejects.toThrow('Validation failed');
});
```

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Check module paths and aliases
npm run test -- --clearCache
```

**Issue**: Database connection errors in tests
```javascript
// Solution: Use in-memory database for tests
const db = new Database(':memory:');
```

**Issue**: Flaky E2E tests
```javascript
// Solution: Add proper waits
await page.waitForSelector('.element', { 
    visible: true, 
    timeout: 5000 
});
```

**Issue**: Slow test execution
```bash
# Solution: Run tests in parallel
npm test -- --maxWorkers=4
```

**Issue**: Coverage not meeting threshold
```bash
# Solution: Find uncovered lines
npm run test:coverage -- --verbose
# Open coverage report
open coverage/lcov-report/index.html
```

### Debug Mode

```bash
# Run tests in debug mode
node --inspect-brk ./node_modules/.bin/jest --runInBand

# Run specific test file
npm test -- validate.test.js

# Run with verbose output
npm test -- --verbose

# Watch mode for development
npm test -- --watch
```

## Testing Checklist

Before submitting PR:

- [ ] All tests pass locally
- [ ] Code coverage meets threshold (80%)
- [ ] No console.log statements in tests
- [ ] Tests are independent and can run in any order
- [ ] New features have corresponding tests
- [ ] Bug fixes include regression tests
- [ ] Integration tests cover API changes
- [ ] Performance tests pass for critical paths
- [ ] E2E tests pass in headless browser
- [ ] CI/CD pipeline is green

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Supertest for API Testing](https://github.com/visionmedia/supertest)
- [Puppeteer for E2E Testing](https://pptr.dev/)
- [SQLite Testing Guide](https://www.sqlite.org/testing.html)