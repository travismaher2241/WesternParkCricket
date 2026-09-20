/* Pure arcade rules shared by the game and headless checks. */
(function (root) {
  'use strict';
  const levels = { easy: { flight: 1.38, window: .24 }, normal: { flight: 1.12, window: .18 }, hard: { flight: .92, window: .135 } };
  function judge(offset, side, line, difficulty) {
    const w = levels[difficulty].window, error = Math.abs(offset);
    if (side !== Math.sign(line)) return { runs: 0, wicket: true, title: 'BOWLED!', detail: 'Wrong side — follow the ball' };
    if (error > w * 1.65) return { runs: 0, wicket: true, title: 'BOWLED!', detail: offset < 0 ? 'Too early — wait for the ball' : 'Too late — swing a little sooner' };
    if (error > w) return { runs: 0, wicket: false, title: 'DOT BALL', detail: offset < 0 ? 'Early — off the toe of the bat' : 'Late — straight to the fielder' };
    if (error < w * .25) return { runs: 6, wicket: false, title: 'SIX!', detail: 'Sweet timing. Out of the park!' };
    if (error < w * .55) return { runs: 4, wicket: false, title: 'FOUR!', detail: 'Cracking shot. Beats the field!' };
    return { runs: error < w * .8 ? 2 : 1, wicket: false, title: error < w * .8 ? 'TWO RUNS' : 'ONE RUN', detail: offset < 0 ? 'A little early — keep watching' : 'A little late — good enough for runs' };
  }
  function complete(state) { return !state.practice && (state.balls >= 12 || state.wickets >= 3); }
  const api = { levels, judge, complete };
  if (typeof module !== 'undefined') module.exports = api; else root.ArcadeRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
