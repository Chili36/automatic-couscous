// Main server for FoodEx2 validation service
// This integrates the complete ICT validation implementation
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const FoodEx2Service = require('./foodex2-service');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Initialize FoodEx2 service
async function initializeService() {
    const service = new FoodEx2Service();
    await service.initialize();
    return service;
}

// API Routes - maintaining compatibility with original API
app.post('/api/validate', async (req, res) => {
    try {
        const { code, context = 'ICT' } = req.body;
        
        if (!code) {
            return res.status(400).json({ 
                error: 'Code is required' 
            });
        }

        console.log(`Validating code: ${code}`);
        const result = await req.app.locals.foodex2Service.validateCode(code, { context });
        console.log(`Validation complete for: ${code}`);
        
        // Format response to match original API
        res.json({
            code,
            valid: result.valid,
            warnings: result.warnings,
            baseTerm: result.baseTerm,
            facets: result.facets || [],
            cleanedCode: result.cleanedCode || result.originalCode,
            interpretedDescription: result.interpretedDescription,
            severity: result.severity
        });
    } catch (error) {
        console.error('Validation error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Validation failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.post('/api/validate/batch', async (req, res) => {
    try {
        const { codes } = req.body;
        
        if (!codes || !Array.isArray(codes)) {
            return res.status(400).json({ 
                error: 'Codes array is required' 
            });
        }

        const results = await req.app.locals.foodex2Service.validateBatch(codes);
        const stats = req.app.locals.foodex2Service.validator.getValidationStats(results);

        res.json({
            results,
            statistics: stats
        });
    } catch (error) {
        console.error('Batch validation error:', error);
        res.status(500).json({ 
            error: 'Batch validation failed',
            message: error.message 
        });
    }
});

app.get('/api/rules', async (req, res) => {
    try {
        // Return information about all implemented rules
        const rules = {
            vba: [
                { id: 'VBA-1', name: 'Facet Structure', description: 'Facets must follow format Fxx.YYYYY' },
                { id: 'VBA-2', name: 'Implicit Facet Removal', description: 'Implicit facets are removed with warning' },
                { id: 'VBA-3', name: 'Descriptor Validation', description: 'All facet descriptors must exist' },
                { id: 'VBA-4', name: 'Single Cardinality', description: 'Certain facet groups allow only one instance' }
            ],
            business: [
                { id: 'BR01', name: 'Source Commodity Raw', description: 'F27 validation for raw terms' },
                { id: 'BR03', name: 'No F01 in Composite', description: 'Source facet forbidden in composite' },
                { id: 'BR04', name: 'No F27 in Composite', description: 'Source-commodities forbidden in composite' },
                { id: 'BR05', name: 'F27 Derivative Restriction', description: 'F27 must be more specific for derivatives' },
                { id: 'BR06', name: 'F01 Requires F27', description: 'Source requires source-commodities in derivatives' },
                { id: 'BR07', name: 'F01 Single F27', description: 'Source with single source-commodity only' },
                { id: 'BR08', name: 'Reporting Hierarchy', description: 'Term must belong to reporting hierarchy' },
                { id: 'BR10', name: 'Non-Specific Terms', description: 'Non-specific terms discouraged' },
                { id: 'BR11', name: 'Generic Process', description: 'Generic process terms discouraged' },
                { id: 'BR12', name: 'Ingredient Restrictions', description: 'F04 restrictions for raw/derivative' },
                { id: 'BR13', name: 'Physical State', description: 'Physical state creates derivatives' },
                { id: 'BR16', name: 'Process Detail Level', description: 'Process must be detailed enough' },
                { id: 'BR17', name: 'No Facet Base Terms', description: 'Facets cannot be base terms' },
                { id: 'BR19', name: 'Forbidden Processes', description: 'Some processes forbidden on raw' },
                { id: 'BR20', name: 'Deprecated Terms', description: 'Cannot use deprecated terms' },
                { id: 'BR21', name: 'Dismissed Terms', description: 'Cannot use dismissed terms' },
                { id: 'BR23', name: 'Hierarchy Terms', description: 'Hierarchy terms discouraged' },
                { id: 'BR24', name: 'Non-Exposure Hierarchy', description: 'Must be exposure hierarchy' },
                { id: 'BR25', name: 'Single Cardinality', description: 'One facet per category' },
                { id: 'BR26', name: 'Mutually Exclusive', description: 'Processes cannot be combined' },
                { id: 'BR27', name: 'Decimal OrdCode', description: 'Process creates new derivative' },
                { id: 'BR28', name: 'Reconstitution', description: 'No reconstitution on dehydrated' }
            ]
        };
        
        res.json(rules);
    } catch (error) {
        console.error('Rules error:', error);
        res.status(500).json({ 
            error: 'Failed to get rules',
            message: error.message 
        });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, type = 'all', limit = 50 } = req.query;

        if (!q) {
            return res.status(400).json({
                error: 'Query parameter q is required'
            });
        }

        const results = await req.app.locals.foodex2Service.searchTerms(q, {
            type,
            limit: parseInt(limit)
        });

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

app.get('/api/term/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const term = await req.app.locals.foodex2Service.getTermDetails(code);

        if (!term) {
            return res.status(404).json({
                error: 'Term not found'
            });
        }

        res.json(term);
    } catch (error) {
        console.error('Term details error:', error);
        res.status(500).json({
            error: 'Failed to get term details',
            message: error.message
        });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await req.app.locals.foodex2Service.db.get('SELECT 1');
        
        res.json({
            status: 'healthy',
            service: 'FoodEx2 Validator',
            version: '2.0.0',
            implementation: 'Complete ICT validation logic',
            rules: {
                vba: 'Structural validation implemented',
                business: '31 business rules implemented'
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
async function startServer() {
    try {
        console.log('Initializing FoodEx2 validation service...');
        app.locals.foodex2Service = await initializeService();
        
        app.listen(PORT, () => {
            console.log(`FoodEx2 validation service (ICT implementation) running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            console.log('\nImplemented validation:');
            console.log('- VBA structural validation');
            console.log('- All 31 business rules (BR01-BR31)');
            console.log('- Complete ICT compatibility');
        });

        // Graceful shutdown
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        async function shutdown() {
            console.log('\nShutting down gracefully...');
            if (app.locals.foodex2Service) {
                await app.locals.foodex2Service.close();
            }
            process.exit(0);
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();