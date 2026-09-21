/* Launching a browser for the tools.

   The tools ask Playwright for the 'chrome' channel, which needs a real
   Google Chrome installed. A development machine has one; a Claude Code web
   session does not — there the only browser is the Chromium that ships with
   Playwright, under PLAYWRIGHT_BROWSERS_PATH. Asking for a channel that is
   not there fails the run before a single assertion, so ask for Chrome first
   and fall back to the bundled build rather than refusing to test.

   Set PLAYWRIGHT_CHROMIUM to point at a different binary. */
const { chromium } = require('playwright');
const fs = require('node:fs');

const BUNDLED = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';

async function launch(options) {
  const opts = Object.assign({ headless: true }, options);
  try {
    return await chromium.launch(Object.assign({ channel: 'chrome' }, opts));
  } catch (chromeErr) {
    if (fs.existsSync(BUNDLED)) {
      return chromium.launch(Object.assign({ executablePath: BUNDLED }, opts));
    }
    // Whatever `npx playwright install` put in place, if anything. Report the
    // original failure if that is missing too, since it is the useful one.
    try {
      return await chromium.launch(opts);
    } catch (_) {
      throw chromeErr;
    }
  }
}

module.exports = { launch };
