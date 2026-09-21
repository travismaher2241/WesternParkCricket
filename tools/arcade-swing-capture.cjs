/* Swing contact sheet.

   Drives the game frame by frame with a stubbed requestAnimationFrame, plays
   each of the four strokes, and samples the batter through the swing into one
   grid image per stroke. This is how the arc, the bat length and the
   follow-through get checked without trying to catch a 0.9s animation by eye.

   Needs the dev server running:  node tools/serve.js 5174
   Then:                          node tools/arcade-swing-capture.cjs
*/
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:5174';
// Swing times to sample, in seconds from the key press.
const SAMPLES = [0, .04, .08, .12, .16, .20, .26, .34, .44, .58, .74, .90];
const COLS = 6;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Hand-crank the animation loop so every sample lands on an exact time.
  await page.addInitScript(() => {
    let pending = null, clock = 0;
    window.requestAnimationFrame = cb => { pending = cb; return 1; };
    window.__step = ms => { clock += ms; const cb = pending; pending = null; if (cb) cb(clock); };
  });

  await page.goto(URL);
  // Practice, so a long capture never runs out of deliveries mid-sheet.
  await page.locator('#practice').click();

  const strokes = [
    { name: 'pull',  side: -1, bounce: .55, line: -.85 },
    { name: 'flick', side: -1, bounce: .69, line: -.85 },
    { name: 'cut',   side:  1, bounce: .55, line:  .85 },
    { name: 'drive', side:  1, bounce: .69, line:  .85 }
  ];

  const report = [];
  for (const stroke of strokes) {
    const info = await page.evaluate(async ({ stroke, SAMPLES, COLS }) => {
      const D = window.BoundaryBashDebug, s = D.state();
      const step = ms => window.__step(ms);

      // Run forward to a fresh delivery, then force the length we want.
      let guard = 0;
      while ((s.pending || s.phase !== 'delivery') && guard++ < 4000) step(16);
      s.bounce = stroke.bounce; s.line = stroke.line;
      // Advance to a perfectly timed press.
      guard = 0;
      while (s.time < s.flight && guard++ < 4000) step(8);

      const g = D.geometry();
      const bh = Math.min(Math.max(136 * g.scale, 87), 150);
      const clip = { x: Math.round(g.cx - 20 * g.scale - bh * .95), y: Math.round(g.near - bh * 1.18),
                     w: Math.round(bh * 2.0), h: Math.round(bh * 1.35) };

      const cell = { w: 210, h: Math.round(210 * clip.h / clip.w) };
      const rows = Math.ceil(SAMPLES.length / COLS);
      const sheet = document.createElement('canvas');
      sheet.width = cell.w * COLS; sheet.height = cell.h * rows;
      sheet.id = 'sheet';
      sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#0b1420';
      const sctx = sheet.getContext('2d');
      const game = document.getElementById('game');
      const dpr = game.width / parseFloat(getComputedStyle(game).width);

      D.shot(stroke.side);
      // How close the blade gets to the ball at the moment of contact. This is
      // the number that says whether the stroke actually plays at the ball.
      const c = D.swingPose(D.SWING.contact);
      const a = c.ang * Math.PI / 180;
      const tip = { x: c.hx + 43 * Math.sin(a), y: c.hy + 43 * Math.cos(a) };
      const b = D.ballAtContact();
      const along = ((b.x - c.hx) * (tip.x - c.hx) + (b.y - c.hy) * (tip.y - c.hy)) / (43 * 43);
      const k2 = Math.max(0, Math.min(1, along));
      const gap = Math.hypot(b.x - (c.hx + (tip.x - c.hx) * k2), b.y - (c.hy + (tip.y - c.hy) * k2));
      const seen = [];
      let target = 0, elapsed = 0;
      guard = 0;
      while (target < SAMPLES.length && guard++ < 4000) {
        if (elapsed >= SAMPLES[target] - 1e-6) {
          const i = target++;
          const col = i % COLS, row = Math.floor(i / COLS);
          sctx.drawImage(game, clip.x * dpr, clip.y * dpr, clip.w * dpr, clip.h * dpr,
            col * cell.w, row * cell.h, cell.w, cell.h);
          sctx.fillStyle = '#ffd25c';
          sctx.font = '600 13px Arial';
          sctx.fillText(SAMPLES[i].toFixed(2) + 's', col * cell.w + 7, row * cell.h + 17);
          sctx.strokeStyle = '#ffffff22';
          sctx.strokeRect(col * cell.w + .5, row * cell.h + .5, cell.w - 1, cell.h - 1);
          seen.push({ t: SAMPLES[i], ang: Math.round(D.swingPose(SAMPLES[i]).ang) });
          continue;
        }
        step(8); elapsed += .008;
      }

      document.body.appendChild(sheet);
      return { stroke: s.stroke, seen, clip, phase: s.phase, runs: s.runs,
               gap: Math.round(gap * 10) / 10, ballLocal: { x: Math.round(b.x), y: Math.round(b.y) } };
    }, { stroke, SAMPLES, COLS });

    await page.locator('#sheet').screenshot({ path: `artifacts/swing-${stroke.name}.png` });
    await page.evaluate(() => document.getElementById('sheet').remove());
    report.push({ asked: stroke.name, played: info.stroke, gap: info.gap, ball: info.ballLocal, angles: info.seen.map(x => x.ang).join(" ") });
  }

  console.log(JSON.stringify({ errors, report }, null, 2));
  await browser.close();
})();
