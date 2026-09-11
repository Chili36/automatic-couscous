// BR26 dormant-method root resolution and normal-runtime exclusion tests
//
// BR_Data.csv keys process ordinal codes per ROOT_GROUP_CODE. The validator
// must resolve the base term's single warn group (the term itself, or its
// closest report-hierarchy ancestor, that appears in BR_Data) and read every
// process's ord code from that root's rows only — matching ICT's
// TermRules.getWarnGroup / getForbiddenProcesses / mutuallyExclusiveCheck.
//
// The nested-root pairs in BR_Data (A04MB and A00HQ both sit under A07XJ in
// the report hierarchy) are what make global or per-process resolution
// observably wrong.
const FoodEx2Service = require('../server/foodex2-service');

const testCases = [
    {
        name: 'Derivative root A01BJ: A07JQ + A07JR share ord 1 under A01BJ',
        code: 'A01BJ#F28.A07JQ$F28.A07JR',
        expectBR26: true
    },
    {
        name: 'Derivative root A0BY3: A07JQ + A07JR share ord 3 under A0BY3',
        code: 'A0BY3#F28.A07JQ$F28.A07JR',
        expectBR26: true
    },
    {
        name: 'Derivative root A04MB: A0BYN + A0BYP share ord 4 under A04MB',
        code: 'A04MB#F28.A0BYN$F28.A0BYP',
        expectBR26: true
    },
    {
        name: 'Cross-root leak: A07JQ is not in warn group A04MB, must not ' +
              'inherit ord 5 from ancestor root A07XJ (A07JT is ord 5 under A04MB)',
        code: 'A00ZB#F28.A07JT$F28.A07JQ',
        expectBR26: false
    },
    {
        name: 'Self-first warn group: base term A04MB is itself a root, its own ' +
              'rows (A07JT ord 5) win over ancestor A07XJ (A07JT ord 2, A0CQZ ord 2)',
        code: 'A04MB#F28.A07JT$F28.A0CQZ',
        expectBR26: false
    },
    {
        name: 'Same-root collision below the root: A0C6N + A07LN share ord 1.1 ' +
              'under warn group A04MB',
        code: 'A00ZB#F28.A0C6N$F28.A07LN',
        expectBR26: true,
        expectBR27: false
    },
    {
        name: 'Active BR27 still detects distinct decimals in the same root',
        code: 'A00ZB#F28.A0C6N$F28.A07KF',
        expectBR26: false,
        expectBR27: true
    }
];

async function testBR26() {
    const service = new FoodEx2Service();
    let failures = 0;

    try {
        await service.initialize();
        console.log('✓ Service initialized\n');

        for (const testCase of testCases) {
            const result = await service.validateCode(testCase.code);
            const rules = (result.warnings || []).map(w => w.rule);
            const fired = rules.includes('BR26');
            const br27Fired = rules.includes('BR27');
            const { baseTermCode, facetString } = service.validator.parseFullCode(testCase.code);
            const parsed = await service.validator.runVBAValidation(baseTermCode, facetString);
            const directWarnings = [];
            await service.validator.businessRulesValidator.checkBR26(
                parsed.baseTerm, parsed.cleanedFacets || [], directWarnings
            );
            const directFired = directWarnings.some(w => w.rule === 'BR26');
            const passed = !fired && directFired === testCase.expectBR26 &&
                (testCase.expectBR27 === undefined || br27Fired === testCase.expectBR27);

            console.log(`Test: ${testCase.name}`);
            console.log(`Code: ${testCase.code}`);
            console.log(`Runtime BR26: ${fired} (expected: false); dormant method: ${directFired} (expected: ${testCase.expectBR26})`);
            if (testCase.expectBR27 !== undefined) {
                console.log(`BR27 fired: ${br27Fired} (expected: ${testCase.expectBR27})`);
            }
            console.log(passed ? '✓ PASSED' : '✗ FAILED');
            console.log('---\n');

            if (!passed) failures++;
        }
    } catch (error) {
        console.error('Test run failed:', error);
        failures++;
    } finally {
        await service.close();
    }

    console.log(failures === 0
        ? `✓ All ${testCases.length} BR26 tests passed`
        : `✗ ${failures} of ${testCases.length} BR26 tests failed`);
    process.exit(failures === 0 ? 0 : 1);
}

testBR26();
