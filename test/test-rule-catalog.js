const assert = require('assert').strict;
const http = require('http');
const FoodEx2Validator = require('../server/validators/foodex2-validator');
const app = require('../server/index');

function checkCatalog(catalog) {
    for (const key of ['business', 'hardRules', 'softRules', 'infoRules']) {
        assert(!catalog[key].some(rule => rule.id === 'BR26'), `${key} must exclude dormant BR26`);
    }
    assert(catalog.business.some(rule => rule.id === 'BR27'), 'BR27 remains active');
}

function getRules(port) {
    return new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port, path: '/api/rules' }, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                try {
                    assert.equal(res.statusCode, 200);
                    resolve(JSON.parse(body));
                } catch (error) { reject(error); }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    const validator = new FoodEx2Validator(null);
    validator.warningMessages = {
        BR26: { text: 'Dormant rule', severity: 'HIGH' },
        BR27: { text: 'Active rule', severity: 'HIGH' },
        BR22: { text: 'Information', severity: 'NONE' }
    };
    const catalog = validator.getRuleCatalog();
    checkCatalog(catalog);
    assert(catalog.hardRules.some(rule => rule.id === 'BR27'));
    assert(catalog.infoRules.some(rule => rule.id === 'BR22'));

    const server = await new Promise((resolve, reject) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        listener.on('error', reject);
    });
    try {
        // Metadata fallback must not reintroduce BR26 before service initialization.
        checkCatalog(await getRules(server.address().port));
        app.locals.foodex2Service = { validator };
        const response = await getRules(server.address().port);
        checkCatalog(response);
        assert(response.hardRules.some(rule => rule.id === 'BR27'));
        console.log('Rule catalog and /api/rules exclude BR26 and retain BR27');
    } finally {
        delete app.locals.foodex2Service;
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
