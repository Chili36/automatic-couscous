const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const DatabaseValidator = require('./database-validator');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Initialize validator
const validator = new DatabaseValidator();

// API Routes
app.post('/api/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    
    const result = await validator.validate(code);
    res.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/validate/batch', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ error: 'Codes array is required' });
    }
    
    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 10000;
    if (codes.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ 
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} codes` 
      });
    }
    
    // Get concurrency from query params or use default
    const concurrency = Math.min(
      parseInt(req.query.concurrency) || 50,
      100 // Max concurrency limit
    );
    
    console.log(`Processing batch of ${codes.length} codes with concurrency ${concurrency}`);
    
    // Process codes in chunks with controlled concurrency
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < codes.length; i += concurrency) {
      const chunk = codes.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(code => validator.validate(code))
      );
      results.push(...chunkResults);
      
      // Log progress for large batches
      if (codes.length > 100 && (i + concurrency) % 500 === 0) {
        const processed = Math.min(i + concurrency, codes.length);
        console.log(`Processed ${processed}/${codes.length} codes...`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Batch validation completed: ${codes.length} codes in ${totalTime}ms`);
    
    res.json(results);
  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get validation rules info
app.get('/api/rules', (req, res) => {
  res.json(validator.getRulesInfo());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`FoodEx2 Validator Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/validate       - Validate single code`);
  console.log(`  POST /api/validate/batch - Validate multiple codes`);
  console.log(`  GET  /api/rules         - Get validation rules info`);
});