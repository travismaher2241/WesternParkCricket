/* Pure arcade rules shared by the game and headless checks. */
(function (root) {
  'use strict';
  const levels = { easy: { flight: 1.38, window: .24 }, normal: { flight: 1.12, window: .18 }, hard: { flight: .92, window: .135 } };
  function miss(line, detail) {
    const wicket = Math.abs(line) < .12;
    return { runs: 0, wicket, missed: true, title: wicket ? 'BOWLED!' : 'DOT BALL', detail: detail + (wicket ? ' — through to the stumps' : ' — past the bat, safely through') };
  }
  function judge(offset, side, line, difficulty) {
    const w = levels[difficulty].window, error = Math.abs(offset);
    let timing = 'GOOD';
    if (error > w * 1.65) timing = offset < 0 ? 'VERY EARLY' : 'VERY LATE';
    else if (error > w) timing = offset < 0 ? 'EARLY' : 'LATE';
    else if (error < w * .25) timing = 'PERFECT';
    else if (error < w * .55) timing = 'GOOD';
    else timing = 'DECENT';

    if (side === 0) {
      if (Math.abs(line) > .55) return Object.assign(miss(line, 'Outside line for straight drive'), { timing });
    } else if (side !== Math.sign(line) && Math.abs(line) >= .12) {
      return Object.assign(miss(line, 'Wrong side'), { timing });
    }
    if (error > w * 1.65) return Object.assign(miss(line, offset < 0 ? 'Too early' : 'Too late'), { timing });
    if (error > w) return { runs: 0, wicket: false, timing, title: 'DOT BALL', detail: offset < 0 ? 'Early — off the toe of the bat' : 'Late — straight to the fielder' };
    if (error < w * .25) return { runs: 6, wicket: false, timing, title: 'SIX!', detail: 'Sweet timing. Out of the park!' };
    if (error < w * .55) return { runs: 4, wicket: false, timing, title: 'FOUR!', detail: 'Cracking shot. Beats the field!' };
    return { runs: error < w * .8 ? 2 : 1, wicket: false, timing, title: error < w * .8 ? 'TWO RUNS' : 'ONE RUN', detail: offset < 0 ? 'A little early — keep watching' : 'A little late — good enough for runs' };
  }
  function complete(state) { return !state.practice && (state.balls >= 12 || state.wickets >= 3); }
  const api = { levels, judge, miss, complete };
  if (typeof module !== 'undefined') module.exports = api; else root.ArcadeRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
