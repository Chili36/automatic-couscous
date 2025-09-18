// Puppeteer test for FoodEx2 validator
const puppeteer = require('puppeteer');

async function testFoodEx2Validator() {
    console.log('Starting Puppeteer test for FoodEx2 validator...\n');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            console.log('Browser console:', msg.text());
        });
        
        // Log network errors
        page.on('response', response => {
            if (!response.ok()) {
                console.log(`Network error: ${response.status()} ${response.url()}`);
            }
        });
        
        console.log('1. Testing API health endpoint...');
        const healthResponse = await page.goto('http://localhost:5001/api/health');
        const healthData = await healthResponse.json();
        console.log('Health check:', healthData);
        console.log('✓ API is healthy\n');
        
        console.log('2. Testing validation API directly...');
        // Test the API endpoint directly
        const apiResponse = await page.evaluate(async () => {
            const response = await fetch('http://localhost:5001/api/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: 'A0BX1#F28.A07KQ',
                    context: 'ICT'
                })
            });
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error ${response.status}: ${text}`);
            }
            
            return await response.json();
        });
        
        console.log('API Validation result:', JSON.stringify(apiResponse, null, 2));
        console.log('✓ API validation successful\n');
        
        console.log('3. Testing web interface...');
        await page.goto('http://localhost:5178', { waitUntil: 'networkidle0' });
        
        // Wait for the input field
        await page.waitForSelector('#code-input', { timeout: 5000 });
        
        // Clear and type the test code
        await page.click('#code-input', { clickCount: 3 }); // Triple click to select all
        await page.type('#code-input', 'A0BX1#F28.A07KQ');
        
        // Click validate button
        await page.click('#validate-btn');
        
        // Wait for results
        await page.waitForSelector('#result', { timeout: 5000 });
        
        // Get the validation results
        const results = await page.evaluate(() => {
            const resultEl = document.querySelector('#result');
            const validEl = resultEl.querySelector('p:nth-child(1)');
            const warningsEl = resultEl.querySelector('#warnings');
            
            return {
                displayed: resultEl.style.display !== 'none',
                validText: validEl ? validEl.textContent : null,
                warningsText: warningsEl ? warningsEl.textContent : null,
                innerHTML: resultEl.innerHTML
            };
        });
        
        console.log('Web interface results:', results);
        
        // Take a screenshot
        await page.screenshot({ 
            path: 'test-result.png',
            fullPage: true 
        });
        console.log('✓ Screenshot saved as test-result.png\n');
        
        console.log('Test completed successfully!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        
        // Try to get more error details
        if (error.message.includes('500')) {
            console.log('\nDebugging 500 error...');
            
            // Check if database file exists
            const fs = require('fs');
            const dbPath = '/Users/davidfoster/Dev/catalogue-browser/foodex2-validator/data/mtx.db';
            if (fs.existsSync(dbPath)) {
                console.log(`✓ Database file exists at ${dbPath}`);
                console.log(`  Size: ${fs.statSync(dbPath).size} bytes`);
            } else {
                console.log(`✗ Database file NOT FOUND at ${dbPath}`);
            }
            
            // Check if data files exist
            const dataFiles = ['BR_Data.csv', 'warningMessages.txt', 'warningColors.txt'];
            console.log('\nChecking data files:');
            dataFiles.forEach(file => {
                const filePath = `/Users/davidfoster/Dev/catalogue-browser/foodex2-validator/data/${file}`;
                if (fs.existsSync(filePath)) {
                    console.log(`✓ ${file} exists`);
                } else {
                    console.log(`✗ ${file} NOT FOUND`);
                }
            });
        }
        
        throw error;
    } finally {
        await browser.close();
    }
}

// Run the test
testFoodEx2Validator()
    .then(() => {
        console.log('\n✓ All tests passed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Test failed:', error);
        process.exit(1);
    });