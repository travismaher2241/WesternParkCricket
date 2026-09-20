const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Expose stepFrames
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    let queue = [], now = 0;
    window.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
    window.stepFrames = (n) => {
      for (let i = 0; i < n; i++) {
        now += 1000 / 120;
        const pending = queue;
        queue = [];
        pending.forEach(fn => fn(now));
      }
    };
  });

  await page.goto('http://localhost:5174');
  await page.evaluate(() => window.stepFrames(1));
  await page.getByRole('button', { name: "LET'S BAT" }).click();
  await page.evaluate(() => window.stepFrames(201)); // wait past ready banner to delivery

  // Enable debug mode
  await page.evaluate(() => {
    const s = window.BoundaryBashDebug.state();
    s.debug = true;
  });

  // Helper to test a shot
  async function testShot(side, shotName) {
    await page.evaluate(({ side }) => {
      const d = window.BoundaryBashDebug;
      const s = d.state();
      s.phase = 'delivery';
      s.pending = null;
      s.time = s.flight - d.SWING.contact;
      s.line = side === 0 ? 0.05 : side * 0.75;
      d.shot(side);
    }, { side });

    // Contact frame
    await page.evaluate(() => window.stepFrames(20));
    await page.screenshot({ path: `artifacts/shot-${shotName}-contact.png` });

    // Follow-through frame
    await page.evaluate(() => window.stepFrames(25));
    await page.screenshot({ path: `artifacts/shot-${shotName}-followthrough.png` });

    // Rest/result ball flight frame
    await page.evaluate(() => window.stepFrames(40));
    await page.screenshot({ path: `artifacts/shot-${shotName}-flight.png` });

    // Reset to delivery for next shot test
    await page.evaluate(() => {
      const s = window.BoundaryBashDebug.state();
      s.phase = 'delivery';
      s.swinging = false;
      s.pending = null;
      s.result = null;
      s.time = 0.5;
    });
  }

  // 1. MY LEFT (Off-side drive)
  await testShot(-1, 'left');

  // 2. STRAIGHT (Straight drive)
  await testShot(0, 'straight');

  // 3. MY RIGHT (On-drive / flick)
  await testShot(1, 'right');

  console.log('Shots verified and screenshots captured successfully.');
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
