// Test multiple FoodEx2 codes
const http = require('http');

const testCases = [
    { code: 'A0BX1#F28.A07KQ', description: 'Hierarchy term (Bakery products) with freezing process' },
    { code: 'A0EZJ', description: 'Simple apple base term' },
    { code: 'A0EZJ#F28.A07KS', description: 'Apple with cooking process' },
    { code: 'A000L#F27.A000M', description: 'Raw commodity with source commodity facet' },
    { code: 'A0B6L#F01.A077V', description: 'Composite with forbidden F01 (should fail)' }
];

function validateCode(code) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ code, context: 'ICT' });
        
        const options = {
            hostname: 'localhost',
            port: 5001,
            path: '/api/validate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('Testing multiple FoodEx2 codes:\n');
    
    for (const testCase of testCases) {
        console.log(`\nTest: ${testCase.description}`);
        console.log(`Code: ${testCase.code}`);
        console.log('-'.repeat(50));
        
        try {
            const result = await validateCode(testCase.code);
            
            console.log(`Valid: ${result.valid}`);
            console.log(`Severity: ${result.severity}`);
            
            if (result.baseTerm) {
                console.log(`Base term: ${result.baseTerm.code} - ${result.baseTerm.name} (type: ${result.baseTerm.type})`);
            }
            
            if (result.warnings && result.warnings.length > 0) {
                console.log('Warnings:');
                result.warnings.forEach(w => {
                    console.log(`  - [${w.rule || w.type}] ${w.message} (${w.severity})`);
                });
            } else {
                console.log('No warnings - code is valid!');
            }
            
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

runTests().catch(console.error);