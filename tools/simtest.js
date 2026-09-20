/* Headless simulation harness.

   The build plan asks for a testable cricket model that is independent of
   any artwork. This loads the sim modules with a fake `window`, plays a lot
   of cricket very quickly, and prints the distributions that matter when
   tuning: pitch accuracy, contact spread, and the scoring rate.

   Run:  node tools/simtest.js  [balls]
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'src/core/config.js',
  'src/core/rng.js',
  'src/sim/trajectory.js',
  'src/sim/delivery.js',
  'src/sim/bat.js',
  'src/sim/field.js',
  'src/sim/match.js'
];

const sandbox = { window: {}, Math: Math, console: console };
vm.createContext(sandbox);
for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const CG = sandbox.window.CG;

const N = parseInt(process.argv[2], 10) || 4000;
const diff = CG.DIFFICULTY.normal;
const rng = new CG.Rng(20260920);

function pct(n, d) { return (100 * n / d).toFixed(1) + '%'; }

// ---------------------------------------------------------------- aiming
console.log('\n=== Delivery aiming (does the ball pitch where it was aimed?) ===');
const lengths = [1.0, 3.0, 5.5, 7.5, 9.5];
for (const want of lengths) {
  let err = 0, lineErr = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const d = CG.delivery.make(
      { type: 'stock', lineX: 0.2, lengthD: want },
      { pace: 0.6, accuracy: 1.0 }, diff, rng, 'right');
    if (!d.bounced) continue;
    err += Math.abs(d.bounceD - want);
    lineErr += Math.abs(d.bounceX - 0.2);
    n++;
  }
  console.log(`  aimed ${want.toFixed(1)}m  ->  mean length error ${(err / n).toFixed(3)}m, line error ${(lineErr / n).toFixed(3)}m  (${n}/200 pitched)`);
}

// ---------------------------------------------------------------- carry
console.log('\n=== Carry (metres from the bat, no fielders) ===');
for (const shotId of CG.SHOT_ORDER) {
  const shot = CG.SHOTS[shotId];
  let carries = [], firstBounce = [];
  for (let i = 0; i < 300; i++) {
    const len = (shot.len[0] + shot.len[1]) / 2;
    const d = CG.delivery.make({ type: 'stock', lineX: 0.15, lengthD: len },
      { pace: 0.6, accuracy: 1 }, diff, rng, 'right');
    const foot = shot.foot === 'back' ? 'back' : 'front';
    const tIdeal = CG.traj.crossingTime(d.traj, CG.bat.contactPlane(foot));
    if (tIdeal == null) continue;
    const res = CG.bat.resolve(d, { handed: 'right', foot, aim: 0, shotId, power: 0.5 }, tIdeal, diff, rng);
    if (!res.post) continue;
    const end = res.post.samples[res.post.restIndex];
    const b = res.post.bounceIndex >= 0 ? res.post.samples[res.post.bounceIndex] : null;
    carries.push(Math.hypot(end.x, end.y - res.contactY));
    if (b) firstBounce.push(Math.hypot(b.x, b.y - res.contactY));
  }
  const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  console.log(`  ${shot.name.padEnd(11)} middled: first pitch ${avg(firstBounce).toFixed(1)}m, total ${avg(carries).toFixed(1)}m  (rope ${CG.C.BOUNDARY_RY}m straight / ${CG.C.BOUNDARY_RX}m square)`);
}

// ---------------------------------------------------------------- outcomes
console.log('\n=== Perfect-timing outcome mix, ' + N + ' balls ===');
const tally = {};
const contact = {};
let runs = 0, balls = 0, wickets = 0;
for (let i = 0; i < N; i++) {
  const plan = CG.delivery.aiPlan(rng, diff, { ballsLeft: 6, runsThisOver: 4 });
  const d = CG.delivery.make(plan.plan, plan.exec, diff, rng, 'right');
  if (d.illegal) { tally[d.illegal.type] = (tally[d.illegal.type] || 0) + 1; continue; }
  const ai = CG.bat.aiBat(d, diff, rng, {});
  const res = CG.bat.resolve(d, ai.batter, ai.pressT, diff, rng);
  contact[res.contact] = (contact[res.contact] || 0) + 1;
  balls++;
  if (res.out) { wickets++; tally[res.out.mode] = (tally[res.out.mode] || 0) + 1; continue; }
  if (!res.post) { tally.dot = (tally.dot || 0) + 1; continue; }
  const fr = CG.field.resolve(res.post, { handed: 'right', diff, rng });
  runs += fr.runs;
  if (fr.out) { wickets++; tally[fr.out.mode] = (tally[fr.out.mode] || 0) + 1; }
  else tally['r' + fr.runs] = (tally['r' + fr.runs] || 0) + 1;
}
console.log('  contact:', Object.entries(contact).map(([k, v]) => `${k} ${pct(v, balls)}`).join('  '));
console.log('  results:', Object.entries(tally).sort().map(([k, v]) => `${k} ${v}`).join('  '));
console.log(`  run rate ${(runs / balls * 6).toFixed(2)} per over,  a wicket every ${(balls / wickets).toFixed(1)} balls`);

// ---------------------------------------------------------------- matches
console.log('\n=== 400 AI-vs-AI two-over matches ===');
const scores = [];
for (let m = 0; m < 400; m++) {
  const match = new CG.Match({ diff, seed: m });
  for (let inn = 0; inn < 2; inn++) {
    match.startInnings(inn === 0 ? CG.TEAM.home : CG.TEAM.away,
      inn === 0 ? CG.TEAM.away : CG.TEAM.home, ['A', 'B']);
    while (!match.inningsOver()) {
      const plan = CG.delivery.aiPlan(rng, diff, { ballsLeft: match.ballsLeft(), runsThisOver: match.overRuns });
      const d = CG.delivery.make(plan.plan, plan.exec, diff, rng, 'right');
      if (d.illegal) { match.applyBall(d, null, null); continue; }
      const ai = CG.bat.aiBat(d, diff, rng, {});
      const res = CG.bat.resolve(d, ai.batter, ai.pressT, diff, rng);
      const fr = res.post ? CG.field.resolve(res.post, { handed: 'right', diff, rng }) : null;
      match.applyBall(d, res, fr);
    }
    const s = match.endInnings();
    scores.push(s.runs);
  }
}
scores.sort((a, b) => a - b);
const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
console.log(`  innings score: min ${scores[0]}  p25 ${scores[Math.floor(scores.length * 0.25)]}  median ${scores[Math.floor(scores.length / 2)]}  p75 ${scores[Math.floor(scores.length * 0.75)]}  max ${scores[scores.length - 1]}  mean ${mean.toFixed(1)}`);
console.log('');
