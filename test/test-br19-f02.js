// BR19 F02 part-nature bypass, allFacets exposure and redundancy info (#29)
//
// BR19 forbids processes that turn a raw commodity into a derivative. The
// same state can be expressed through an F02 part-nature (e.g. "Flakes (as
// part-nature)") instead of an F28 process. The F02 -> F28 equivalence is not
// hand-maintained: it is derived from the catalogue, where each derivative
// base term carries both its part-nature and its process as implicit facets
// (A04QY Cereal flakes: F02.A068E + F28.A07LG).
const assert = require('assert').strict;
const FoodEx2Service = require('../server/foodex2-service');

const rulesOf = result => (result.warnings || []).map(w => w.rule);

const testCases = [
    {
        name: 'Explicit forbidden F28 on raw commodity still fires plain BR19',
        code: 'A000L#F28.A07LG',
        check: result => {
            const br19 = result.warnings.find(w => w.rule === 'BR19');
            assert(br19, 'BR19 expected');
            assert.equal(br19.source, 'efsa');
        }
    },
    {
        name: 'Equivalent F02 part-nature (Flakes) fires BR19+ derived from catalogue',
        code: 'A000L#F02.A068E',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert.equal(hit.source, 'derived');
            assert.equal(hit.facet, 'F02.A068E');
            assert.deepEqual(hit.equivalentProcesses, ['A07LG']);
            assert.equal(hit.suggestedBaseTerm, 'A04QY');
            assert.deepEqual(hit.suggestedBaseTerms, ['A04QY']);
            assert.equal(hit.severity, 'ERROR');
            assert.equal(result.valid, false);
        }
    },
    {
        name: 'F02 flour on cereal grains maps to forbidden grain milling',
        code: 'A000L#F02.A067Z',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert.equal(hit.suggestedBaseTerm, 'A04KS');
        }
    },
    {
        name: 'No derivative matches the base commodity: list candidates, do not guess one',
        code: 'A0DMX#F02.A068V',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert.equal(hit.suggestedBaseTerm, undefined, 'ambiguous: no single suggestion');
            for (const code of ['A04PQ', 'A03DB']) {
                assert(hit.suggestedBaseTerms.includes(code), `${code} must be a candidate`);
                assert(hit.message.includes(code), `message must list ${code}`);
            }
        }
    },
    {
        name: 'Raw terms are never suggested as the replacement',
        code: 'A0DMX#F02.A0ERV',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert(!hit.suggestedBaseTerms.includes('A012R'), 'raw A012R must not be suggested');
            assert.deepEqual(hit.suggestedBaseTerms, ['A185Q']);
        }
    },
    {
        name: 'Composite candidate is described accurately, not as a derivative',
        code: 'A0DMX#F02.A068X',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert.deepEqual(hit.suggestedBaseTerms, ['A03BB']);
            assert(!hit.message.includes('derivative base term A03BB'), hit.message);
            assert(hit.message.includes('composite base term A03BB'), hit.message);
        }
    },
    {
        name: 'Part-nature implying several forbidden processes names all of them',
        code: 'A02LV#F02.A06BN',
        check: result => {
            const hit = result.warnings.find(w => w.rule === 'BR19+');
            assert(hit, `BR19+ expected, got ${rulesOf(result)}`);
            assert(hit.equivalentProcesses.length > 1, `several processes expected, got ${hit.equivalentProcesses}`);
            for (const code of hit.equivalentProcesses) {
                assert(hit.message.includes(`F28.${code}`), `message must name F28.${code}`);
            }
        }
    },
    {
        name: 'Anatomical F02 already in allFacets: info note only, no BR19+',
        code: 'A01YM#F02.A069N',
        check: result => {
            const rules = rulesOf(result);
            assert(!rules.includes('BR19') && !rules.includes('BR19+'), `no BR19 expected, got ${rules}`);
            const info = result.infoWarnings.find(w => w.rule === 'SR10');
            assert(info, `SR10 info expected, got ${rules}`);
            assert.equal(info.involvedTerms, 'F02.A069N');
            assert.equal(result.hardWarnings.length, 0);
            assert(result.baseTerm.allFacets.includes('F02.A069N'), 'allFacets must include inherited F02');
            assert(!result.baseTerm.implicitFacets.includes('F02.A069N'), 'implicitFacets must not');
        }
    },
    {
        name: 'Raw dry pulse restating its inherited F02 (Dried legumes) is not a bypass',
        code: 'A012S#F02.A0ERV',
        check: result => {
            const rules = rulesOf(result);
            assert(!rules.includes('BR19+'), `no BR19+ expected, got ${rules}`);
            assert(rules.includes('SR10'), `SR10 info expected, got ${rules}`);
            assert.equal(result.valid, true);
        }
    },
    {
        name: 'Facet not in allFacets gets no redundancy note',
        code: 'A01YM#F28.A07GL',
        check: result => {
            assert(!rulesOf(result).includes('SR10'));
        }
    }
];

async function testDerivedMap(service) {
    const brv = service.validator.businessRulesValidator;
    const map = await brv.getF02ProcessEquivalents();
    // Guards against a catalogue release that changes the implicit facet
    // format and silently empties the derived map.
    assert(map.size >= 50, `derived F02 map too small: ${map.size}`);
    assert(map.get('A068E').some(e => e.processCode === 'A07LG'));
    assert(map.get('A0ELN').some(e => e.processCode === 'A07KG'));
    assert(!map.has('A069N'), 'anatomical part-nature must not map to a process');
    // A process that only some derivatives of a part-nature carry is extra
    // processing, not the part-nature itself (dried egg yolk, pulse flour).
    const processesOf = code => (map.get(code) || []).map(e => e.processCode);
    assert(processesOf('A06BT').includes('A07LC'));
    assert(!processesOf('A06BT').includes('A07KG'), 'Egg yolk must not map to Drying');
    assert(!processesOf('A0ERV').includes('A07LA'), 'Dried legumes must not map to Grinding');
}

async function testStrictParity() {
    process.env.STRICT_ICT_PARITY = '1';
    const service = new FoodEx2Service();
    try {
        await service.initialize();
        const result = await service.validateCode('A000L#F02.A068E');
        assert(!rulesOf(result).includes('BR19+'), 'STRICT_ICT_PARITY must disable BR19+');
    } finally {
        delete process.env.STRICT_ICT_PARITY;
        await service.close();
    }
}

async function run() {
    const service = new FoodEx2Service();
    let failures = 0;
    const total = testCases.length + 2;

    const attempt = async (name, fn) => {
        try {
            await fn();
            console.log(`✓ ${name}`);
        } catch (error) {
            console.log(`✗ ${name}\n  ${error.message}`);
            failures++;
        }
    };

    try {
        await service.initialize();
        for (const testCase of testCases) {
            await attempt(`${testCase.name} (${testCase.code})`, async () =>
                testCase.check(await service.validateCode(testCase.code)));
        }
        await attempt('Derived F02 -> F28 map is built from the catalogue', () => testDerivedMap(service));
    } catch (error) {
        console.error('Test run failed:', error);
        failures++;
    } finally {
        await service.close();
    }

    await attempt('STRICT_ICT_PARITY=1 disables BR19+', testStrictParity);

    console.log(failures === 0
        ? `✓ All ${total} BR19 F02 tests passed`
        : `✗ ${failures} of ${total} BR19 F02 tests failed`);
    process.exit(failures === 0 ? 0 : 1);
}

run();
