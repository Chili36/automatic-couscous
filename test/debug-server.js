// Debug script to test the server
const Database = require('../server/database');
const FoodEx2Service = require('../server/foodex2-service');

async function testService() {
    console.log('Testing FoodEx2 service initialization...\n');
    
    try {
        // Test database connection
        console.log('1. Testing database connection...');
        const db = new Database();
        await db.initialize();
        console.log('✓ Database connected\n');
        
        // Test a simple query
        console.log('2. Testing database query...');
        const result = await db.get('SELECT COUNT(*) as count FROM terms');
        console.log(`✓ Found ${result.count} terms in database\n`);
        
        // Test service initialization
        console.log('3. Testing service initialization...');
        const service = new FoodEx2Service();
        await service.initialize();
        console.log('✓ Service initialized\n');
        
        // Test validation
        console.log('4. Testing validation...');
        const validationResult = await service.validateCode('A0BX1#F28.A07KQ');
        console.log('✓ Validation completed');
        console.log('Result has valid field:', 'valid' in validationResult);
        console.log('Valid value:', validationResult.valid);
        console.log('Result:', JSON.stringify(validationResult, null, 2));
        
        await service.close();
        await db.close();
        
    } catch (error) {
        console.error('\n✗ Error occurred:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    }
}

testService();