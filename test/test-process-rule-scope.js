const assert = require('assert').strict;
const BusinessRulesValidator = require('../server/validators/business-rules-validator');

// Synthetic catalogue rows exercise real facet parsing and root-scoped lookup.
// Expected outcomes follow EFSA TermRules.java at commit
// 9a028ee0efe6a018e7f941ce0a4f7e6488b80e43: mutuallyExclusiveCheck and
// decimalOrderCheck. Stock ICT's BR26 invocation itself is disabled.
const cases = [
    { name: 'BR26 skips implicit-only collisions', implicit: [1, 1], explicit: [], expected: [] },
    { name: 'An unrelated explicit facet does not enable BR26', implicit: [1, 1], explicit: [], other: ['F03.other'], expected: [] },
    { name: 'BR26 checks implicit and explicit together', implicit: [1], explicit: [1], expected: ['BR26'] },
    { name: 'BR26 checks two explicit processes', implicit: [], explicit: [1, 1], expected: ['BR26'] },
    { name: 'Any explicit process enables the combined BR26 set', implicit: [1, 1], explicit: [0], expected: ['BR26'] },
    { name: 'Zero ordinals do not conflict', implicit: [0], explicit: [0, 0], expected: [] },
    { name: 'Different integer ordinals do not conflict', implicit: [1], explicit: [2], expected: [] },
    { name: 'Equal mixed decimal values trigger only BR26', implicit: [1.1], explicit: [1.1], expected: ['BR26'] },
    { name: 'Equal explicit decimal values trigger only BR26', implicit: [], explicit: [1.1, 1.1], expected: ['BR26'] },
    { name: 'Different mixed decimal values trigger BR27', implicit: [1.1], explicit: [1.2], expected: ['BR27'] },
    { name: 'Different explicit decimal values trigger BR27', implicit: [], explicit: [1.1, 1.2], expected: ['BR27'] },
    { name: 'Implicit-only decimal families do not trigger BR27', implicit: [1.1, 1.2], explicit: [], expected: [] },
    { name: 'Explicit process must belong to the decimal family', implicit: [1.1, 1.2], explicit: [2.1], expected: [] },
    { name: 'An integer process does not activate a decimal family', implicit: [1.1, 1.2], explicit: [1], expected: [] },
    { name: 'Different families do not conflict', implicit: [1.1], explicit: [2.2], expected: [] },
    { name: 'Both rules can fire in the same family', implicit: [1.1, 1.2], explicit: [1.1], expected: ['BR26', 'BR27'] },
    { name: 'Raw bases are outside both rule scopes', type: 'r', implicit: [1.1], explicit: [1.1, 1.2], expected: [] },
    { name: 'Empty process sets are allowed', implicit: [], explicit: [], expected: [] },
];

async function runCase(c) {
    const rows = [];
    function facets(ordinals) {
        return ordinals.map(ordinalCode => {
            const code = `synthetic${rows.length}`;
            rows.push({ rootGroupCode: 'root', forbiddenProcessCode: code, ordinalCode });
            return `F28.${code}`;
        });
    }
    const implicitFacets = facets(c.implicit);
    const explicitFacets = [...facets(c.explicit), ...(c.other || [])];
    const validator = new BusinessRulesValidator(null, {}, rows);
    // Only the ancestor database boundary is stubbed; root selection,
    // ordinal resolution and both rule methods run unchanged.
    validator.hierarchyHelper.getAncestors = async () => [];
    const base = { code: 'root', type: c.type || 'd', implicit_facets: implicitFacets.join('$') };
    const warnings = [];
    await validator.checkBR26(base, explicitFacets, warnings);
    await validator.checkBR27(base, explicitFacets, warnings);
    assert.deepEqual(warnings.map(w => w.rule).sort(), c.expected, c.name);
}

async function main() {
    for (const c of cases) {
        await runCase(c);
        console.log(`PASS: ${c.name}`);
    }
    console.log(`All ${cases.length} process-scope tests passed`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
