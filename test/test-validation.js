// Test script for FoodEx2 validation
const FoodEx2Service = require('../server/foodex2-service');

async function testValidation() {
    const service = new FoodEx2Service();
    
    try {
        await service.initialize();
        console.log('✓ Service initialized\n');

        // Test cases covering different scenarios
        const testCases = [
            {
                name: 'Valid raw commodity with F27',
                code: 'A000L#F27.A000M',
                expectedValid: true
            },
            {
                name: 'Composite with forbidden F01',
                code: 'A0B6L#F01.A077V',
                expectedValid: false,
                expectedRule: 'BR03'
            },
            {
                name: 'Composite with forbidden F27',
                code: 'A0B6L#F27.A000M',
                expectedValid: false,
                expectedRule: 'BR04'
            },
            {
                name: 'Raw commodity with forbidden process',
                code: 'A000L#F28.A07LG',
                expectedValid: false,
                expectedRule: 'BR19'
            },
            {
                name: 'Multiple single cardinality facets',
                code: 'A000L#F01.A077V$F01.A077W',
                expectedValid: false,
                expectedRule: 'VBA'
            },
            {
                name: 'Invalid facet structure',
                code: 'A000L#F01A077V',
                expectedValid: false,
                expectedRule: 'VBA'
            },
            {
                name: 'Non-existent base term',
                code: 'XXXXX#F01.A077V',
                expectedValid: false,
                expectedRule: 'VBA'
            },
            {
                name: 'Facet as base term',
                code: 'A077V',
                expectedValid: false,
                expectedRule: 'BR17'
            },
            {
                name: 'Hierarchy base term triggers soft rule',
                code: 'A000J',
                expectedValid: true,
                expectedSeverity: 'LOW',
                expectedSoftWarnings: 1
            }
        ];

        console.log('Running validation tests...\n');

        for (const testCase of testCases) {
            console.log(`Test: ${testCase.name}`);
            console.log(`Code: ${testCase.code}`);
            
            const result = await service.validateCode(testCase.code);
            
            console.log(`Valid: ${result.valid} (expected: ${testCase.expectedValid})`);
            console.log(`Severity: ${result.severity}`);

            if (result.warnings.length > 0) {
                console.log('Warnings:');
                result.warnings.forEach(w => {
                    console.log(`  - [${w.rule || w.type}] ${w.message} (${w.severity})`);
                });
            }

            if (typeof testCase.expectedSoftWarnings === 'number') {
                const softWarnings = result.softWarnings || [];
                console.log(`Soft warnings: ${softWarnings.length} (expected: ${testCase.expectedSoftWarnings})`);
            }

            if (testCase.expectedSeverity) {
                console.log(`Expected severity: ${testCase.expectedSeverity}`);
            }

            if (result.interpretedDescription) {
                console.log(`Interpreted: ${result.interpretedDescription}`);
            }

            // Check if test passed
            let passed = result.valid === testCase.expectedValid;

            if (typeof testCase.expectedSoftWarnings === 'number') {
                const softWarnings = result.softWarnings || [];
                passed = passed && softWarnings.length === testCase.expectedSoftWarnings;
            }

            if (testCase.expectedSeverity) {
                passed = passed && result.severity === testCase.expectedSeverity;
            }

            console.log(passed ? '✓ PASSED' : '✗ FAILED');
            console.log('---\n');
        }

        // Test batch validation
        console.log('Testing batch validation...');
        const batchCodes = [
            'A000L#F27.A000M',
            'A0B6L#F01.A077V',
            'A000L#F28.A07LG$F03.A0C0D'
        ];

        const batchResults = await service.validateBatch(batchCodes, {
            onProgress: (current, total) => {
                console.log(`Progress: ${current}/${total}`);
            }
        });

        console.log('\nBatch validation results:');
        const stats = service.validator.getValidationStats(batchResults);
        console.log(stats);

        const ruleCatalog = service.validator.getRuleCatalog();
        console.log('\nRule catalog summary:');
        console.log(`Hard rules: ${ruleCatalog.hardRules.length}`);
        console.log(`Soft rules: ${ruleCatalog.softRules.length}`);
        console.log(`Info rules: ${ruleCatalog.infoRules.length}`);

        // Test search functionality
        console.log('\n\nTesting search functionality...');
        const searchResults = await service.searchTerms('wheat', { type: 'baseTerm' });
        console.log(`Found ${searchResults.length} results for "wheat"`);
        searchResults.slice(0, 3).forEach(term => {
            console.log(`  - ${term.code}: ${term.name}`);
        });

        // Test term details
        console.log('\n\nTesting term details...');
        const termDetails = await service.getTermDetails('A000L');
        if (termDetails) {
            console.log(`Term: ${termDetails.code} - ${termDetails.name}`);
            console.log(`Type: ${termDetails.type}`);
            console.log(`Implicit facets: ${termDetails.implicitFacets.length}`);
            termDetails.implicitFacets.forEach(f => {
                console.log(`  - ${f.facetCode}: ${f.descriptor}`);
            });
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await service.close();
        console.log('\n✓ Service closed');
    }
}

// Run the tests
testValidation().catch(console.error);