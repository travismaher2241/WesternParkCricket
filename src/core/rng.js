/* Seeded random number generator.
   A match runs from one seed so a session can be replayed while tuning. */
(function (CG) {
  'use strict';

  function Rng(seed) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  // mulberry32
  Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  Rng.prototype.range = function (lo, hi) {
    return lo + (hi - lo) * this.next();
  };

  Rng.prototype.int = function (lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  };

  Rng.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };

  Rng.prototype.chance = function (p) {
    return this.next() < p;
  };

  // Box-Muller, clamped so freak values never leave the playable envelope.
  Rng.prototype.gauss = function (mean, sd, clampSd) {
    var u = 1 - this.next();
    var v = this.next();
    var g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    var lim = clampSd || 2.6;
    if (g > lim) g = lim;
    if (g < -lim) g = -lim;
    return mean + g * sd;
  };

  CG.Rng = Rng;

})(window.CG = window.CG || {});
