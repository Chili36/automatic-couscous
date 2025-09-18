// Simple test for FoodEx2 validation API
const http = require('http');

const testCode = 'A0BX1#F28.A07KQ';

const postData = JSON.stringify({
    code: testCode,
    context: 'ICT'
});

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

console.log(`Testing validation of: ${testCode}\n`);

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('\nValidation Result:');
            console.log('================');
            console.log(`Code: ${result.code}`);
            console.log(`Valid: ${result.valid}`);
            console.log(`Severity: ${result.severity}`);
            
            if (result.baseTerm) {
                console.log(`\nBase Term: ${result.baseTerm.code} - ${result.baseTerm.name}`);
                console.log(`Type: ${result.baseTerm.type} (composite)`);
            }
            
            if (result.warnings && result.warnings.length > 0) {
                console.log('\nWarnings:');
                result.warnings.forEach((w, i) => {
                    console.log(`${i + 1}. [${w.rule || w.type}] ${w.message} (${w.severity})`);
                });
            } else {
                console.log('\nNo warnings!');
            }
            
            if (result.interpretedDescription) {
                console.log(`\nInterpreted: ${result.interpretedDescription}`);
            }
        } catch (e) {
            console.error('Error parsing response:', e);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();