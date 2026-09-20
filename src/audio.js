/* Sound.

   Synthesised rather than sampled, so the vertical slice has the right audio
   shape - bat crack, pad thump, stumps, scattered applause, magpies - without
   waiting on recordings. Each call is a short envelope over an oscillator or
   a noise burst. Real audio drops in behind the same call names. */
(function (CG) {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;
  var noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function env(node, t0, attack, decay, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    g.connect(master);
    return g;
  }

  function tone(freq, t0, attack, decay, peak, type, bend) {
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t0 + attack + decay);
    env(o, t0, attack, decay, peak);
    o.start(t0);
    o.stop(t0 + attack + decay + 0.05);
    return o;
  }

  function burst(t0, attack, decay, peak, filterType, freq, q) {
    var s = ctx.createBufferSource();
    s.buffer = noise();
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = q || 1;
    s.connect(f);
    env(f, t0, attack, decay, peak);
    s.start(t0);
    s.stop(t0 + attack + decay + 0.05);
    return s;
  }

  var A = {
    setEnabled: function (v) { enabled = v; if (v) ensure(); },
    isEnabled: function () { return enabled; },
    resume: function () {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },

    /* Bat on ball. Quality decides how sweet the crack is. */
    bat: function (quality) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      if (quality > 0.62) {
        tone(1650, t, 0.002, 0.11, 0.42, 'triangle', 620);
        burst(t, 0.001, 0.05, 0.28, 'bandpass', 2600, 1.4);
      } else if (quality > 0.4) {
        tone(900, t, 0.003, 0.13, 0.26, 'triangle', 380);
        burst(t, 0.002, 0.07, 0.16, 'lowpass', 1400, 0.8);
      } else {
        tone(420, t, 0.004, 0.16, 0.22, 'sine', 180);
        burst(t, 0.003, 0.09, 0.13, 'lowpass', 700, 0.7);
      }
    },

    pad: function () {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      tone(180, t, 0.004, 0.16, 0.30, 'sine', 70);
      burst(t, 0.003, 0.10, 0.12, 'lowpass', 500, 0.6);
    },

    stumps: function () {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      [1400, 1900, 2400].forEach(function (f, i) {
        tone(f, t + i * 0.035, 0.002, 0.16, 0.22, 'square', f * 0.45);
      });
      burst(t, 0.002, 0.25, 0.18, 'highpass', 1800, 0.9);
    },

    glove: function () {
      if (!enabled || !ensure()) return;
      burst(ctx.currentTime, 0.002, 0.08, 0.20, 'lowpass', 900, 0.7);
    },

    bounce: function () {
      if (!enabled || !ensure()) return;
      burst(ctx.currentTime, 0.002, 0.05, 0.10, 'bandpass', 700, 1.2);
    },

    /* Scattered applause from a few dozen people at a junior game. */
    applause: function (size) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      var n = Math.round(6 + size * 22);
      for (var i = 0; i < n; i++) {
        burst(t + Math.random() * (0.6 + size * 0.9), 0.002, 0.05 + Math.random() * 0.05,
          0.03 + size * 0.05, 'bandpass', 1400 + Math.random() * 2600, 2.2);
      }
      if (size > 0.7) {
        tone(300, t + 0.05, 0.08, 0.8, 0.10, 'sawtooth', 420);
      }
    },

    groan: function () {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      tone(210, t, 0.08, 0.55, 0.10, 'sawtooth', 120);
    },

    /* A magpie somewhere behind the nets. */
    magpie: function () {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 5; i++) {
        var f = 760 + Math.random() * 680;
        tone(f, t + i * 0.13, 0.03, 0.12, 0.055, 'sine', f * (0.6 + Math.random() * 0.9));
      }
    },

    call: function () {   // a teammate shouting "yes!"
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      tone(320, t, 0.02, 0.18, 0.12, 'sawtooth', 240);
    },

    ui: function (up) {
      if (!enabled || !ensure()) return;
      tone(up ? 660 : 420, ctx.currentTime, 0.004, 0.07, 0.10, 'square');
    },

    meterStop: function (good) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      tone(good ? 880 : 300, t, 0.003, 0.1, 0.16, 'square', good ? 1320 : 220);
    }
  };

  CG.audio = A;

})(window.CG = window.CG || {});
