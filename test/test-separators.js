// Facet separator validation (#33)
//
// In FoodEx2, '#' appears exactly once, between the base term and the facets,
// and facets are separated by '$'. ICT (Decoders.bas / FacetChecker.bas)
// requires '#' at position 6 and splits the facets on '$' only, so any other
// separator layout is a structural error, not something to repair silently.
const assert = require('assert').strict;
const FoodEx2Service = require('../server/foodex2-service');

const separatorWarning = result => (result.warnings || []).find(w => w.rule === 'VBA-SEPARATOR');

const invalidCases = [
    {
        name: "'#' between facets",
        code: 'A00EN#F04.A001D#F21.A07SE#F23.A07TH',
        suggested: 'A00EN#F04.A001D$F21.A07SE$F23.A07TH'
    },
    {
        name: "'$' and '#' mixed between facets",
        code: 'A03EL#F03.A06JL$F18.A07NM$F19.A16RP#F28.A07JN'
    },
    { name: "'$' instead of '#' after the base term", code: 'A00EN$F04.A001D' },
    { name: "no separator after the base term", code: 'A00ENF04.A001D' },
    { name: 'empty facet between separators', code: 'A00EN#F04.A001D$$F21.A07SE' },
    { name: "trailing '$'", code: 'A00EN#F04.A001D$' },
    { name: "'#' with no facets", code: 'A00EN#' }
];

const validCases = [
    { name: 'well-formed facets', code: 'A00EN#F04.A001D$F21.A07SE' },
    { name: 'base term only', code: 'A00EN' }
];

async function run() {
    const service = new FoodEx2Service();
    let failures = 0;
    const total = invalidCases.length + validCases.length;

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

        for (const testCase of invalidCases) {
            await attempt(`Rejects ${testCase.name} (${testCase.code})`, async () => {
                const result = await service.validateCode(testCase.code);
                const warning = separatorWarning(result);
                assert(warning, `VBA-SEPARATOR expected, got ${(result.warnings || []).map(w => w.rule)}`);
                assert.equal(warning.severity, 'ERROR');
                assert.equal(result.valid, false);
                assert(result.hardWarnings.includes(warning), 'must be a hard warning');
                if (testCase.suggested) {
                    assert.equal(warning.suggestedCode, testCase.suggested);
                    assert.equal(result.cleanedCode, testCase.suggested);
                    assert(warning.message.includes(testCase.suggested), 'message must show the suggestion');
                }
            });
        }

        for (const testCase of validCases) {
            await attempt(`Accepts ${testCase.name} (${testCase.code})`, async () => {
                const result = await service.validateCode(testCase.code);
                assert(!separatorWarning(result), `no VBA-SEPARATOR expected: ${separatorWarning(result) && separatorWarning(result).message}`);
            });
        }
    } catch (error) {
        console.error('Test run failed:', error);
        failures++;
    } finally {
        await service.close();
    }

    console.log(failures === 0
        ? `✓ All ${total} separator tests passed`
        : `✗ ${failures} of ${total} separator tests failed`);
    process.exit(failures === 0 ? 0 : 1);
}

run();
