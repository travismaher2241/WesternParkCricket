/* Numeric check on the swing.

   Sweeps every line and length the game can serve, on both sides, and reports
   how far the blade finishes from the ball at the moment of contact, plus how
   far the bat turns between frames. Catches both "the bat never reaches the
   ball" and "the bat teleports" without anyone having to watch it.

   Needs the dev server running:  node tools/serve.js 5174
*/
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5174';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    let pending = null, clock = 0;
    window.requestAnimationFrame = cb => { pending = cb; return 1; };
    window.__step = ms => { clock += ms; const cb = pending; pending = null; if (cb) cb(clock); };
  });
  await page.goto(URL);
  // Practice has no innings limit, so the sweep never runs out of deliveries.
  await page.locator('#practice').click();

  const out = await page.evaluate(() => {
    const D = window.BoundaryBashDebug, s = D.state(), step = ms => window.__step(ms);
    const BAT = 43;
    const rows = [], jumps = [];

    const lines = [-1, -.86, -.72, -.1, .1, .72, .86, 1];
    const lengths = [.52, .58, .62, .66, .72];
    // Press early, on time and late.
    const offsets = [-.1, 0, .1];

    for (const line of lines) for (const bounce of lengths) for (const side of [-1, 1]) for (const off of offsets) {
      let guard = 0;
      while ((s.pending || s.phase !== 'delivery') && guard++ < 6000) step(16);
      s.line = line; s.bounce = bounce;
      guard = 0;
      while (s.time < s.flight - D.SWING.contact + off && guard++ < 6000) step(8);
      D.shot(side);

      const wrongSide = side !== Math.sign(line) && Math.abs(line) >= .12;

      // Distance from the ball to the blade at contact.
      const c = D.swingPose(D.SWING.contact), a = c.ang * Math.PI / 180;
      const tipX = c.hx + BAT * Math.sin(a), tipY = c.hy + BAT * Math.cos(a);
      const b = D.ballAtContact();
      const k = Math.max(0, Math.min(1, ((b.x - c.hx) * (tipX - c.hx) + (b.y - c.hy) * (tipY - c.hy)) / (BAT * BAT)));
      const gap = Math.hypot(b.x - (c.hx + (tipX - c.hx) * k), b.y - (c.hy + (tipY - c.hy) * k));
      if (!wrongSide) rows.push({ line, bounce, side, off, stroke: s.stroke, gap: +gap.toFixed(1) });

      // Biggest turn of the bat between two 1/60s frames anywhere in the swing.
      let worst = 0, at = 0, prev = D.swingPose(0).ang;
      for (let t = 1 / 60; t <= D.SWING.rest; t += 1 / 60) {
        const ang = D.swingPose(t).ang;
        const d = Math.abs(ang - prev);
        if (d > worst) { worst = d; at = t; }
        prev = ang;
      }
      jumps.push({ stroke: s.stroke, worst: Math.round(worst), at: +at.toFixed(2) });

      // Let the ball finish so the next delivery starts clean.
      guard = 0;
      while ((s.pending || s.phase !== 'delivery') && guard++ < 6000) step(16);
    }

    const gaps = rows.map(r => r.gap).sort((x, y) => x - y);
    const byStroke = {};
    rows.forEach(r => { (byStroke[r.stroke] = byStroke[r.stroke] || []).push(r.gap); });
    const worstJump = jumps.reduce((m, j) => j.worst > m.worst ? j : m, { worst: 0 });
    return {
      shots: rows.length,
      gapMedian: gaps[Math.floor(gaps.length / 2)],
      gapP90: gaps[Math.floor(gaps.length * .9)],
      gapMax: gaps[gaps.length - 1],
      worstGaps: rows.slice().sort((a, b) => b.gap - a.gap).slice(0, 5),
      perStroke: Object.fromEntries(Object.entries(byStroke).map(([k2, v]) =>
        [k2, { n: v.length, median: v.sort((x, y) => x - y)[Math.floor(v.length / 2)], max: v[v.length - 1] }])),
      worstFrameTurn: worstJump
    };
  });

  console.log(JSON.stringify({ errors, ...out }, null, 2));
  await browser.close();
})();
