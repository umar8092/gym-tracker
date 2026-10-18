// The version shown in problem reports must match the service worker version.
const fs = require('fs'), assert = require('assert');
const sw = /VERSION = '([^']+)'/.exec(fs.readFileSync(__dirname + '/../sw.js', 'utf8'))[1], app = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(__dirname + '/../js/app.js', 'utf8'))[1];
assert.strictEqual(app, sw, 'APP_VERSION in js/app.js (' + app + ') must equal VERSION in sw.js (' + sw + ')'); console.log('version OK ' + sw);
