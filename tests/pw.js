// Finds playwright-core: PW_CORE env var, then a normal install, then the author's global copy.
const tries = [process.env.PW_CORE, 'playwright-core', '/Users/muhammadumar/.local/lib/node_modules/@playwright/cli/node_modules/playwright-core'].filter(Boolean);
for (const t of tries) { try { module.exports = require(t); break; } catch (e) {} }
if (!module.exports.chromium) { throw new Error('playwright-core not found. Run: npm install'); }
