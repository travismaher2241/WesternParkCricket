/* Game loop, input and presentation.

   The phase machine here only ever *shows* what the simulation already
   decided. When the player commits to a stroke, the shot is resolved
   immediately and the animation then plays that resolved ball out. */
(function (CG) {
  'use strict';

  var C = CG.C;
  var P = CG.PALETTE;
  var V = CG.view;
  var S = CG.scene;
  var A = CG.audio;

  var RUNUP_T = 1.65;
  var PLAYER_H = 1.62;          // junior player height, metres

  var g = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
    cam: null, td: null,
    mode: 'menu', phase: 'menu', phaseT: 0,
    diff: CG.DIFFICULTY.normal,
    handed: 'right',
    rng: null, match: null,
    humanRole: 'bat',
    ball: null, prevBall: null,
    fx: [], logItems: [],
    lastT: 0, soundOn: true,
    shakeT: 0, paused: false,
    intro: 0,
    inp: { foot: 'front', aim: 0 },
    bowl: { type: 'stock', markX: 0.18, markLen: 5.5, stage: 'plan', pace: 0.6, acc: 0.5, meter: { v: 0, dir: 1 } },
    keys: {}
  };
  CG.game = g;

  function mirror() { return g.handed === 'left' ? -1 : 1; }

  // ------------------------------------------------------------------ setup

  function init() {
    g.canvas = document.getElementById('stage');
    g.ctx = g.canvas.getContext('2d');
    g.cam = new V.Camera();
    g.td = new V.TopDown();
    resize();
    window.addEventListener('resize', resize);
    bindUI();
    bindKeys();
    buildDeliveryButtons();
    g.lastT = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    g.dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.w = g.canvas.clientWidth || window.innerWidth;
    g.h = g.canvas.clientHeight || window.innerHeight;
    g.canvas.width = Math.round(g.w * g.dpr);
    g.canvas.height = Math.round(g.h * g.dpr);
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  }

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------- match flow

  function startMatch(mode) {
    g.mode = mode;
    g.rng = new CG.Rng((Date.now() ^ 0x5f3a) >>> 0);
    g.fx = []; g.logItems = [];
    $('menu').classList.add('hidden');
    $('results').classList.add('hidden');
    $('hud').classList.remove('hidden');
    A.resume();

    if (mode === 'practice-bat' || mode === 'practice-bowl') {
      g.match = new CG.Match({ diff: g.diff, seed: 1, overs: 99, wickets: 99 });
      g.humanRole = (mode === 'practice-bat') ? 'bat' : 'bowl';
      var batting = g.humanRole === 'bat' ? CG.TEAM.home : CG.TEAM.away;
      var bowling = g.humanRole === 'bat' ? CG.TEAM.away : CG.TEAM.home;
      g.match.startInnings(batting, bowling,
        g.humanRole === 'bat' ? [CG.HERO.name] : ['Drouin opener']);
      $('readout').classList.remove('hidden');
      setPhase('intro');
      return;
    }

    g.match = new CG.Match({ diff: g.diff, seed: 1 });
    g.humanRole = 'bat';
    g.match.startInnings(CG.TEAM.home, CG.TEAM.away, [CG.HERO.name, CG.HERO.partner]);
    $('readout').classList.add('hidden');
    setPhase('intro');
  }

  function setPhase(p) {
    g.phase = p;
    g.phaseT = 0;
    if (p === 'intro') {
      g.intro = 0;
      showCentre(
        g.humanRole === 'bat' ? 'Western Park Oval' : 'Liam to bowl',
        g.match.target != null
          ? (CG.TEAM.away.shortName + ' need ' + g.match.target + ' from ' + g.match.overs + ' overs')
          : 'Western Park Warriors — ' + g.match.overs + ' overs each',
        2600);
      if (g.rng.chance(0.6)) setTimeout(function () { A.magpie(); }, 900);
    }
    if (p === 'setup') {
      g.ball = null;
      refreshControls();
    }
    refreshHud();
  }

  /* Build the next delivery and start the run-up. */
  function beginBall() {
    var handed = (g.humanRole === 'bat') ? g.handed : 'right';
    var delivery;

    if (g.humanRole === 'bat') {
      var ai = CG.delivery.aiPlan(g.rng, g.diff, {
        ballsLeft: g.match.ballsLeft(),
        runsThisOver: g.match.overRuns
      });
      delivery = CG.delivery.make(ai.plan, ai.exec, g.diff, g.rng, handed);
    } else {
      delivery = CG.delivery.make(
        { type: g.bowl.type, lineX: g.bowl.markX, lengthD: g.bowl.markLen },
        { pace: g.bowl.pace, accuracy: g.bowl.acc }, g.diff, g.rng, handed);
    }

    var planeY = CG.bat.contactPlane(g.humanRole === 'bat' ? g.inp.foot : 'front');
    g.ball = {
      delivery: delivery,
      t: -RUNUP_T,
      resolved: false,
      shot: null, field: null, rec: null,
      pressT: null,
      swingT: null,
      contactT: CG.traj.crossingTime(delivery.traj, planeY),
      playT: 0,
      stumpsBroken: false,
      trail: []
    };
    setPhase('runup');
  }

  /* Player (or the AI batter) commits to a stroke. */
  function commitShot(shotId, pressT) {
    if (!g.ball || g.ball.resolved) return;
    var b = g.ball;
    b.pressT = pressT;
    b.swingT = pressT;

    var batter = {
      handed: g.handed, foot: g.inp.foot, aim: g.inp.aim,
      shotId: shotId, power: 0.55
    };
    resolveBall(batter, pressT);
  }

  function resolveBall(batter, pressT) {
    var b = g.ball;
    b.shot = CG.bat.resolve(b.delivery, batter, pressT, g.diff, g.rng);
    b.contactT = CG.traj.crossingTime(b.delivery.traj, b.shot.contactY) || b.contactT;
    if (b.shot.post) {
      b.field = CG.field.resolve(b.shot.post, { handed: batter.handed, diff: g.diff, rng: g.rng });
    }
    b.rec = g.match.applyBall(b.delivery, b.shot, b.field);
    b.resolved = true;
  }

  /* Nothing was played at it. */
  function leaveBall() {
    var batter = { handed: g.handed, foot: g.inp.foot, aim: 0, shotId: 'defend', power: 0.5 };
    resolveBall(batter, (g.ball.contactT || 0) + 99);
    g.ball.leave = true;
  }

  function afterBall() {
    var b = g.ball;
    g.prevBall = b;
    if (b.rec) pushLog(b.rec);
    if (g.mode.indexOf('practice') === 0 && b.shot) showReadout(b);

    if (b.rec && b.rec.wicket) {
      bigMessage(b.rec.wicket.label.toUpperCase(), b.rec.wicket.detail || b.rec.text);
      A.stumps();
      A.groan();
      g.shakeT = 0.35;
    } else if (b.rec && b.rec.runs === 6) {
      bigMessage('SIX!', 'Over the rope at Western Park Oval');
      A.applause(1);
    } else if (b.rec && b.rec.runs === 4) {
      bigMessage('FOUR', b.rec.text);
      A.applause(0.7);
    } else if (b.rec && !b.rec.legal) {
      bigMessage('', b.rec.text);
    } else if (b.field && b.field.dropped) {
      bigMessage('DROPPED', b.field.label);
      A.groan();
    } else if (b.rec && b.rec.runs > 0) {
      bigMessage('', b.rec.text);
    } else {
      bigMessage('', b.rec ? b.rec.text : '');
    }
    refreshHud();
    setPhase('outcome');
  }

  function nextBall() {
    if (g.mode.indexOf('practice') === 0) { setPhase('setup'); return; }

    if (g.match.inningsOver()) {
      var summary = g.match.endInnings();
      if (g.match.completed.length === 1) {
        showCentre(summary.team.shortName + ' ' + summary.runs + '/' + summary.wickets,
          'Liam now bowls. ' + CG.TEAM.away.shortName + ' need ' + (summary.runs + 1) + ' to win.', 3400);
        g.humanRole = 'bowl';
        g.match.startInnings(CG.TEAM.away, CG.TEAM.home, ['Jack', 'Nate']);
        setPhase('break');
      } else {
        endMatch();
      }
      return;
    }
    setPhase('setup');
  }

  function endMatch() {
    var res = g.match.result();
    var first = g.match.completed[0], second = g.match.completed[1];
    $('resTitle').textContent = res.text;
    $('resSub').textContent = 'Western Park Oval, Warragul — ' + g.match.overs + ' overs each';

    var liam = first.batters[0];
    $('resCards').innerHTML =
      inningsCard(first) + inningsCard(second) +
      '<div class="icard"><h4>' + CG.HERO.name + '</h4><div class="big">' + liam.runs +
      '<span style="font-size:14px;color:var(--mid)"> (' + liam.balls + ')</span></div>' +
      '<div class="line"><span>Fours</span><span>' + liam.fours + '</span></div>' +
      '<div class="line"><span>Sixes</span><span>' + liam.sixes + '</span></div>' +
      '<div class="line"><span>Dismissal</span><span>' + (liam.howOut || 'not out') + '</span></div></div>';

    var moments = g.match.highlights(first.log).concat(g.match.highlights(second.log)).slice(0, 7);
    $('resMoments').innerHTML = moments.length
      ? moments.map(function (m) { return '<li>' + m.over + ' — ' + m.text + '</li>'; }).join('')
      : '<li>A quiet evening at Western Park Oval.</li>';

    $('results').classList.remove('hidden');
    $('hud').classList.add('hidden');
    setPhase('done');
    A.applause(0.9);
  }

  function inningsCard(inn) {
    return '<div class="icard"><h4>' + inn.team.shortName + '</h4><div class="big">' +
      inn.runs + '/' + inn.wickets + '</div>' +
      inn.batters.map(function (b) {
        return '<div class="line"><span>' + b.name + '</span><span>' + b.runs + ' (' + b.balls + ')</span></div>';
      }).join('') +
      '<div class="line"><span>Extras</span><span>' + inn.extras + '</span></div></div>';
  }

  // ---------------------------------------------------------------- the loop

  function frame(now) {
    var dt = Math.min(0.05, (now - g.lastT) / 1000);
    g.lastT = now;
    if (!g.paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    g.phaseT += dt;
    if (g.shakeT > 0) g.shakeT = Math.max(0, g.shakeT - dt);

    for (var i = g.fx.length - 1; i >= 0; i--) {
      g.fx[i].t += dt;
      if (g.fx[i].t > g.fx[i].life) g.fx.splice(i, 1);
    }

    switch (g.phase) {
      case 'intro':
        g.intro += dt;
        if (g.phaseT > 2.6) setPhase('setup');
        break;

      case 'break':
        if (g.phaseT > 3.4) setPhase('setup');
        break;

      case 'setup':
        // Batting starts itself so the rhythm of an over keeps moving;
        // bowling waits for the player to send the ball down.
        if (g.humanRole === 'bat' && g.phaseT > 1.1) beginBall();
        break;

      case 'runup':
        updateRunup(dt);
        break;

      case 'flight':
        updateFlight(dt);
        break;

      case 'play':
        updatePlay(dt);
        break;

      case 'outcome':
        if (g.phaseT > (g.ball && g.ball.rec && g.ball.rec.wicket ? 2.4 : 1.5)) {
          hideCentre();
          nextBall();
        }
        break;
    }
  }

  function updateRunup(dt) {
    var b = g.ball;
    b.t += dt;
    if (g.humanRole === 'bowl') updateMeters(dt);
    if (b.t >= 0) {
      b.t = 0;
      setPhase('flight');
    }
  }

  function updateFlight(dt) {
    var b = g.ball;
    var wasBounced = b.bouncedFlag;
    b.t += dt;

    var s = CG.traj.at(b.delivery.traj, b.t);
    if (!wasBounced && s.bounces > 0) { b.bouncedFlag = true; A.bounce(); }

    // The AI batter picks its moment.
    if (g.humanRole === 'bowl' && !b.resolved) {
      if (!b.aiChoice) {
        b.aiChoice = CG.bat.aiBat(b.delivery, g.diff, g.rng,
          { needRate: g.match.requiredRate() });
        if (b.delivery.illegal) {
          b.rec = g.match.applyBall(b.delivery, null, null);
          b.resolved = true;
          pushLog(b.rec);
        }
      }
      if (b.aiChoice && !b.resolved && b.t >= b.aiChoice.pressT) {
        g.inp.foot = b.aiChoice.batter.foot;
        g.inp.aim = b.aiChoice.batter.aim;
        b.swingT = b.t;
        resolveBall(b.aiChoice.batter, b.aiChoice.pressT);
      }
    }

    // The human missed their window entirely.
    if (g.humanRole === 'bat' && !b.resolved) {
      if (b.delivery.illegal && b.t > (b.contactT || 0.6) + 0.25) {
        b.rec = g.match.applyBall(b.delivery, null, null);
        b.resolved = true;
        pushLog(b.rec);
      } else if (b.t > (b.contactT || 0.6) + g.diff.window * 1.6) {
        leaveBall();
      }
    }

    if (b.resolved && b.shot && b.shot.post && b.t >= b.contactT) {
      A.bat(b.shot.quality);
      if (b.shot.contact === 'middle') g.shakeT = 0.16;
      b.playT = 0;
      setPhase('play');
      return;
    }

    if (b.resolved && b.shot && !b.shot.post) {
      // Missed, padded, bowled. Let the ball run through to the keeper.
      if (b.shot.out && b.shot.out.mode === 'bowled' && !b.stumpsBroken &&
          b.delivery.tStumps != null && b.t >= b.delivery.tStumps) {
        b.stumpsBroken = true;
        g.shakeT = 0.3;
      }
      if (b.shot.legBye != null || (b.shot.note && b.shot.note.indexOf('pad') >= 0)) {
        if (!b.padSound && b.delivery.tStumps != null && b.t >= b.contactT) { b.padSound = true; A.pad(); }
      }
      if (b.t > (b.delivery.tStumps || 0.8) + 0.55) { afterBall(); return; }
    }

    if (b.resolved && !b.shot && b.t > (b.delivery.tStumps || 0.8) + 0.5) { afterBall(); return; }

    if (b.t > b.delivery.traj.duration + 0.4 && !b.resolved) { leaveBall(); }
  }

  function updatePlay(dt) {
    var b = g.ball;
    b.playT += dt;
    var f = b.field;
    var end = f ? (f.ballEndT + 1.1) : 2;
    var s = CG.traj.at(b.shot.post, Math.min(b.playT, f ? f.ballEndT : b.shot.post.duration));
    b.trail.push({ x: s.x, y: s.y, z: s.z });
    if (b.trail.length > 90) b.trail.shift();

    if (!b.caughtSound && f && f.out && f.out.mode.indexOf('caught') === 0 && b.playT >= f.interceptT) {
      b.caughtSound = true; A.glove();
    }
    if (b.playT > end) afterBall();
  }

  // --------------------------------------------------------------- bowling

  function updateMeters(dt) {
    var bw = g.bowl;
    if (bw.stage === 'pace' || bw.stage === 'release') {
      var speed = bw.stage === 'pace' ? 1.7 : 2.5;
      bw.meter.v += bw.meter.dir * speed * dt;
      if (bw.meter.v > 1) { bw.meter.v = 1; bw.meter.dir = -1; }
      if (bw.meter.v < 0) { bw.meter.v = 0; bw.meter.dir = 1; }
      paintMeters();

      // Run out of run-up: whatever the marker is on, that is what you get.
      var elapsed = g.ball.t + RUNUP_T;
      if (bw.stage === 'pace' && elapsed > RUNUP_T * 0.52) lockPace();
      else if (bw.stage === 'release' && elapsed > RUNUP_T * 0.95) lockRelease();
    }
  }

  function lockPace() {
    var bw = g.bowl;
    if (bw.stage !== 'pace') return;
    bw.pace = bw.meter.v;
    bw.stage = 'release';
    bw.meter.v = 0; bw.meter.dir = 1;
    A.meterStop(true);
    $('paceMeter').classList.add('locked');
    paintMeters();
  }

  function lockRelease() {
    var bw = g.bowl;
    if (bw.stage !== 'release') return;
    var off = Math.abs(bw.meter.v - 0.5) / 0.5;
    bw.acc = CG.clamp(1 - off * off * 1.15, 0.05, 1);
    bw.stage = 'done';
    A.meterStop(bw.acc > 0.72);
    $('accMeter').classList.add('locked');
    paintMeters();

    // Re-make the delivery now that the release is known.
    g.ball.delivery = CG.delivery.make(
      { type: bw.type, lineX: bw.markX, lengthD: bw.markLen },
      { pace: bw.pace, accuracy: bw.acc }, g.diff, g.rng, 'right');
    g.ball.contactT = CG.traj.crossingTime(g.ball.delivery.traj, CG.bat.contactPlane('front'));
    $('deliveryNote').textContent = releaseWord(bw.acc) + ' — ' + g.ball.delivery.speedKph + ' km/h';
  }

  function releaseWord(acc) {
    if (acc > 0.88) return 'Released beautifully';
    if (acc > 0.66) return 'Good release';
    if (acc > 0.40) return 'Released a little loose';
    return 'Dragged it';
  }

  function startBowling() {
    if (g.phase !== 'setup' || g.humanRole !== 'bowl') return;
    var bw = g.bowl;
    bw.stage = 'pace';
    bw.meter.v = 0; bw.meter.dir = 1;
    $('paceMeter').classList.remove('locked');
    $('accMeter').classList.remove('locked');
    $('deliveryNote').textContent = 'Stop the pace bar';
    beginBall();
  }

  function bowlSpace() {
    if (g.phase === 'setup' && g.humanRole === 'bowl') { startBowling(); return; }
    if (g.phase !== 'runup') return;
    if (g.bowl.stage === 'pace') lockPace();
    else if (g.bowl.stage === 'release') lockRelease();
  }

  // ------------------------------------------------------------------ input

  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      var k = e.key.toLowerCase();
      A.resume();

      if (k === 'escape') { togglePause(); return; }
      if (k === 'm') { toggleSound(); return; }
      if (g.phase === 'menu' || g.phase === 'done') return;

      if (g.humanRole === 'bat') {
        if (k === 'arrowup' || k === 'w') { setFoot('front'); e.preventDefault(); return; }
        if (k === 'arrowdown' || k === 's') { setFoot('back'); e.preventDefault(); return; }
        if (k === 'arrowleft' || k === 'a') { nudgeAim(-1); e.preventDefault(); return; }
        if (k === 'arrowright' || k === 'd') { nudgeAim(1); e.preventDefault(); return; }
        var map = { j: 'defend', k: 'drive', l: 'cross', i: 'loft' };
        if (map[k]) { playShot(map[k]); e.preventDefault(); return; }
      } else {
        if (k === ' ') { bowlSpace(); e.preventDefault(); return; }
        if (k === 'arrowleft') { moveMarker(-0.08, 0); e.preventDefault(); return; }
        if (k === 'arrowright') { moveMarker(0.08, 0); e.preventDefault(); return; }
        if (k === 'arrowup') { moveMarker(0, 0.45); e.preventDefault(); return; }
        if (k === 'arrowdown') { moveMarker(0, -0.45); e.preventDefault(); return; }
        var n = parseInt(k, 10);
        if (n >= 1 && n <= 6) { setDelivery(CG.DELIVERY_ORDER[n - 1]); return; }
      }
    });
  }

  function playShot(shotId) {
    if (g.phase !== 'flight' && g.phase !== 'runup') return;
    if (!g.ball || g.ball.resolved) return;
    // Sub-frame accuracy: the key landed between frames, so add the time
    // that has passed since the last update.
    var t = g.ball.t + (performance.now() - g.lastT) / 1000;
    if (g.phase === 'runup') t = 0;
    commitShot(shotId, t);
  }

  function setFoot(f) {
    g.inp.foot = f;
    A.ui(f === 'front');
    refreshControls();
  }

  function nudgeAim(d) {
    g.inp.aim = CG.clamp(g.inp.aim + d * 0.34, -1, 1);
    A.ui(d > 0);
    refreshControls();
  }

  function setDelivery(id) {
    if (g.phase !== 'setup') return;
    g.bowl.type = id;
    A.ui(true);
    refreshControls();
  }

  function moveMarker(dx, dl) {
    if (g.phase !== 'setup') return;
    g.bowl.markX = CG.clamp(g.bowl.markX + dx, -1.15, 1.15);
    g.bowl.markLen = CG.clamp(g.bowl.markLen + dl, -0.5, 12);
    refreshControls();
  }

  // --------------------------------------------------------------------- UI

  function bindUI() {
    $('btnQuick').onclick = function () { startMatch('match'); };
    $('btnPracticeBat').onclick = function () { startMatch('practice-bat'); };
    $('btnPracticeBowl').onclick = function () { startMatch('practice-bowl'); };
    $('btnAgain').onclick = function () { startMatch(g.mode === 'menu' ? 'match' : g.mode); };
    $('btnMenu').onclick = toMenu;
    $('btnQuit').onclick = toMenu;
    $('btnResume').onclick = togglePause;
    $('btnPause').onclick = togglePause;
    $('btnSound').onclick = toggleSound;
    $('btnBowl').onclick = bowlSpace;

    seg('segDiff', 'diff', function (v) { g.diff = CG.DIFFICULTY[v]; });
    seg('segHand', 'hand', function (v) { g.handed = v; CG.HERO.bats = v; });

    document.querySelectorAll('.foot').forEach(function (b) {
      b.onclick = function () { setFoot(b.dataset.foot); };
    });
    document.querySelectorAll('.aim').forEach(function (b) {
      b.onclick = function () { nudgeAim(parseFloat(b.dataset.aim)); };
    });
    document.querySelectorAll('.shot').forEach(function (b) {
      b.onclick = function () { playShot(b.dataset.shot); };
    });
  }

  function seg(id, attr, fn) {
    var el = $(id);
    el.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        el.querySelectorAll('button').forEach(function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        fn(b.dataset[attr]);
        A.ui(true);
      };
    });
  }

  function buildDeliveryButtons() {
    var row = $('deliveryRow');
    row.innerHTML = CG.DELIVERY_ORDER.map(function (id, i) {
      var d = CG.DELIVERIES[id];
      return '<button data-del="' + id + '"><b>' + (i + 1) + ' ' + d.name + '</b><i>' + d.benefit + '</i></button>';
    }).join('');
    row.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { setDelivery(b.dataset.del); };
    });
  }

  function toMenu() {
    $('menu').classList.remove('hidden');
    $('results').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('hud').classList.add('hidden');
    g.phase = 'menu';
    g.mode = 'menu';
  }

  function togglePause() {
    if (g.phase === 'menu' || g.phase === 'done') return;
    var el = $('pause');
    el.classList.toggle('hidden');
    g.paused = !el.classList.contains('hidden');
  }

  function toggleSound() {
    g.soundOn = !g.soundOn;
    A.setEnabled(g.soundOn);
    $('btnSound').classList.toggle('off', !g.soundOn);
  }

  function refreshControls() {
    var batting = (g.humanRole === 'bat');
    // Keep the touch panel on the opposite side of the screen to the batter.
    document.body.classList.toggle('lefty', batting && g.handed === 'left');
    $('batControls').classList.toggle('hidden', !batting);
    $('bowlControls').classList.toggle('hidden', batting);

    document.querySelectorAll('.foot').forEach(function (b) {
      b.classList.toggle('on', b.dataset.foot === g.inp.foot);
    });
    $('aimNeedle').style.left = (50 + g.inp.aim * 46) + '%';
    $('aimLabel').textContent = aimWord(g.inp.aim);

    document.querySelectorAll('#deliveryRow button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.del === g.bowl.type);
    });
    if (!batting && g.phase === 'setup') {
      var d = CG.DELIVERIES[g.bowl.type];
      $('deliveryNote').textContent = d.name + ' — ' + d.cost;
    }
    paintMeters();
  }

  function aimWord(a) {
    var side = (g.handed === 'left') ? -1 : 1;
    var v = a * side;
    if (v < -0.62) return 'Square leg';
    if (v < -0.22) return 'Midwicket';
    if (v < 0.22) return 'Straight';
    if (v < 0.62) return 'Cover';
    return 'Point';
  }

  function paintMeters() {
    var bw = g.bowl;
    var pm = $('paceMeter'), am = $('accMeter');
    if (!pm) return;
    var pv = (bw.stage === 'pace') ? bw.meter.v : bw.pace;
    pm.querySelector('.fill').style.width = (pv * 100) + '%';
    pm.querySelector('.head').style.left = 'calc(' + (pv * 100) + '% - 1.5px)';
    var av = (bw.stage === 'release') ? bw.meter.v : (bw.stage === 'plan' ? 0.5 : 0.5 + (1 - bw.acc) * 0.5);
    am.querySelector('.head').style.left = 'calc(' + (av * 100) + '% - 1.5px)';
  }

  function refreshHud() {
    if (!g.match) return;
    $('battingTeam').textContent = g.match.battingTeam.shortName;
    $('scoreMain').textContent = g.match.runs + '/' + g.match.wicketsDown;
    $('overs').textContent = g.match.overText() + ' (' + g.match.overs + ')';

    var need = g.match.needed();
    $('chaseLine').textContent = (need == null) ? '' :
      (need + ' to win from ' + g.match.ballsLeft() + ' balls');

    var st = g.match.striker();
    $('batterLine').textContent = st ? (st.name + ' ' + st.runs + ' (' + st.balls + ')') : '';
    refreshControls();
  }

  function pushLog(rec) {
    var mark = rec.wicket ? 'W' : (!rec.legal ? '+' : String(rec.runs));
    g.logItems.unshift('<div><b>' + rec.over + ' ' + mark + '</b> &nbsp;' + rec.text + '</div>');
    g.logItems = g.logItems.slice(0, 6);
    $('log').innerHTML = g.logItems.join('');
  }

  function showCentre(text, sub, ms) {
    $('centreText').textContent = text || '';
    $('centreSub').textContent = sub || '';
    $('centre').classList.remove('hidden');
    if (ms) setTimeout(hideCentre, ms);
  }
  function bigMessage(text, sub) { showCentre(text, sub, 0); }
  function hideCentre() { $('centre').classList.add('hidden'); }

  function showReadout(b) {
    var d = b.delivery, s = b.shot;
    var rows = [
      ['Delivery', d.typeName],
      ['Speed', d.speedKph + ' km/h'],
      ['Length', d.lengthName + ' (' + d.bounceD.toFixed(1) + 'm)'],
      ['Line', d.lineName],
      ['Release', Math.round(d.exec.accuracy * 100) + '%']
    ];
    if (s) {
      rows.push(['Footwork', s.foot === 'front' ? 'Front foot' : 'Back foot']);
      rows.push(['Shot', s.shotName]);
      rows.push(['Timing', s.timingWord + ' (' + (s.timingError * 1000).toFixed(0) + 'ms)']);
      rows.push(['Contact', s.contactName]);
      rows.push(['Quality', Math.round(s.quality * 100) + '%']);
      if (s.launch) rows.push(['Off the bat', s.launch.kph + ' km/h']);
    }
    if (b.field) rows.push(['Fielding', b.field.label]);
    $('readout').innerHTML = '<h4>Last ball</h4>' +
      rows.map(function (r) { return '<div class="r"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; }).join('');
  }

  // ------------------------------------------------------------------ draw

  function draw() {
    var ctx = g.ctx;
    ctx.clearRect(0, 0, g.w, g.h);

    if (g.phase === 'menu' || g.phase === 'done') { drawMenuBackdrop(ctx); return; }
    if (g.phase === 'play' && g.ball && g.ball.field) { drawPlayView(ctx); return; }

    if (g.humanRole === 'bat') drawBattingView(ctx);
    else drawBowlingView(ctx);
  }

  function applyShake(cam) {
    if (g.shakeT > 0) {
      var m = g.shakeT * 26;
      cam.shakeX = (Math.random() - 0.5) * m;
      cam.shakeY = (Math.random() - 0.5) * m;
    } else { cam.shakeX = 0; cam.shakeY = 0; }
  }

  function drawMenuBackdrop(ctx) {
    var cam = g.cam;
    cam.setBehindBatter(g.w, g.h, 1);
    cam.y = C.STRIKER_Y - 22 - Math.sin(performance.now() / 5200) * 5;
    cam.z = 6.4;
    applyShake(cam);
    S.drawGroundScene(ctx, g.w, g.h, cam, { scoreboard: '0 / 0', dusk: true });
    S.drawStumps(ctx, cam, C.BOWLER_Y, false);
    S.drawStumps(ctx, cam, C.STRIKER_Y, false);
    drawFielders(ctx, cam, CG.field.positions('right'), CG.TEAM.away, 'ready');
  }

  function scoreboardText() {
    if (!g.match) return '';
    return g.match.runs + ' / ' + g.match.wicketsDown;
  }

  /* ------------------------------------------------------ behind the batter */
  function drawBattingView(ctx) {
    var cam = g.cam;
    var mir = mirror();
    cam.setBehindBatter(g.w, g.h, mir);
    if (g.phase === 'intro') {
      var k = CG.clamp(g.phaseT / 2.6, 0, 1);
      cam.y = C.STRIKER_Y - 40 + 24 * ease(k);
      cam.z = 11.0 - 6.0 * ease(k);
    }
    applyShake(cam);

    S.drawGroundScene(ctx, g.w, g.h, cam, { scoreboard: scoreboardText(), dusk: true });

    var fielders = CG.field.positions(mir === -1 ? 'left' : 'right');
    drawFielders(ctx, cam, fielders, CG.TEAM.away, 'ready');

    S.drawStumps(ctx, cam, C.BOWLER_Y, false);

    // The non-striker backing up, and the bowler running in.
    drawFigureAt(ctx, cam, -1.15 * mir, C.BOWLER_Y - 1.0, CG.TEAM.home, 'ready', -1,
      { helmet: true, pads: true, gloves: true, bat: false });
    drawBowlerFigure(ctx, cam, CG.TEAM.away);

    // Ball, with a short trail so the line and length are readable at speed.
    if (g.ball && g.ball.t >= 0) {
      drawBallTrail(ctx, cam, g.ball.delivery.traj, g.ball.t);
      var s = CG.traj.at(g.ball.delivery.traj, g.ball.t);
      S.drawBall(ctx, cam, s.x, s.y, s.z);
      if (g.ball.delivery.bounceT != null && g.ball.t > g.ball.delivery.bounceT) {
        drawPitchMark(ctx, cam, g.ball.delivery.bounceX, C.STRIKER_Y + g.ball.delivery.bounceD);
      }
    }

    S.drawStumps(ctx, cam, C.STRIKER_Y, g.ball && g.ball.stumpsBroken);

    drawBatterFigure(ctx, cam, mir);

    drawAimArc(ctx, cam, mir);
    if (g.mode === 'practice-bat') drawTimingBar(ctx);
  }

  /* ------------------------------------------------------ behind the bowler */
  function drawBowlingView(ctx) {
    var cam = g.cam;
    cam.setBehindBowler(g.w, g.h, 1);
    if (g.phase === 'intro') {
      var k = CG.clamp(g.phaseT / 2.6, 0, 1);
      cam.y = C.BOWLER_Y + 46 - 22 * ease(k);
      cam.z = 11.0 - 5.9 * ease(k);
    }
    applyShake(cam);

    S.drawGroundScene(ctx, g.w, g.h, cam, { scoreboard: scoreboardText(), dusk: true });

    var fielders = CG.field.positions('right');
    drawFielders(ctx, cam, fielders, CG.TEAM.home, 'ready');

    S.drawStumps(ctx, cam, C.STRIKER_Y, g.ball && g.ball.stumpsBroken);

    // The batter Liam is bowling at, at the far end.
    var batPose = 'stance';
    if (g.ball && g.ball.swingT != null && g.ball.t >= g.ball.swingT) {
      batPose = shotPose(g.ball.shot ? g.ball.shot.shotId : 'defend');
    } else if (g.ball && g.ball.t > 0.1) batPose = 'backlift';
    drawFigureAt(ctx, cam, -0.42, C.STRIKER_Y - 0.1, CG.TEAM.away, batPose, -1,
      { helmet: true, pads: true, gloves: true });
    drawFigureAt(ctx, cam, 0.1, C.STRIKER_Y - 3.4, CG.TEAM.home, 'keeper', -1, { gloves: true, helmet: false });

    if (g.ball && g.ball.t >= 0) {
      drawBallTrail(ctx, cam, g.ball.delivery.traj, g.ball.t);
      var s = CG.traj.at(g.ball.delivery.traj, g.ball.t);
      S.drawBall(ctx, cam, s.x, s.y, s.z);
    }

    S.drawStumps(ctx, cam, C.BOWLER_Y, false);
    drawBowlerFigure(ctx, cam, CG.TEAM.home, true);

    // Planned landing spot, drawn last so nothing hides it.
    if (g.phase === 'setup' || g.phase === 'runup') {
      drawMarker(ctx, cam, g.bowl.markX, g.bowl.markLen);
    }
  }

  /* ------------------------------------------------------------- ball in play */
  function drawPlayView(ctx) {
    var td = g.td;
    td.fit(g.w, g.h);
    S.drawTopDownGround(ctx, g.w, g.h, td);

    var b = g.ball, f = b.field;
    var t = Math.min(b.playT, f.ballEndT);

    // Fielders, with the chaser moving to the ball.
    f.fielders.forEach(function (fd) {
      var x = fd.x, y = fd.y;
      if (f.chase && f.chase.id === fd.id) {
        var k = CG.clamp((t - f.chase.startT) / Math.max(0.12, f.chase.arriveT - f.chase.startT), 0, 1);
        x = CG.lerp(f.chase.fromX, f.chase.toX, ease(k));
        y = CG.lerp(f.chase.fromY, f.chase.toY, ease(k));
      }
      var p = td.project(x, y);
      ctx.fillStyle = (g.humanRole === 'bat') ? CG.TEAM.away.primary : CG.TEAM.home.primary;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '9px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fd.name, p.sx, p.sy + 17);
    });

    // Batters running between the wickets.
    drawRunners(ctx, td, b, t);

    // Ball trail then the ball itself.
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    b.trail.forEach(function (p, i) {
      var q = td.project(p.x, p.y);
      if (i === 0) ctx.moveTo(q.sx, q.sy); else ctx.lineTo(q.sx, q.sy);
    });
    ctx.stroke();

    var s = CG.traj.at(b.shot.post, t);
    var sp = td.project(s.x, s.y);
    ctx.fillStyle = 'rgba(10,30,14,.32)';
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 5, 0, Math.PI * 2); ctx.fill();
    var lift = Math.min(26, s.z * 2.6);
    ctx.fillStyle = P.ball;
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy - lift, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.ballSeam; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy - lift, 3.4, -0.6, 0.9); ctx.stroke();

    // Height readout for aerial shots - the tension of "is that carrying?"
    if (s.z > 1.5 && s.bounces === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s.z.toFixed(1) + 'm', sp.sx + 10, sp.sy - lift);
    }

    // Shot label.
    if (b.shot && b.shot.launch) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.shot.contactName + ' — ' + b.shot.shotName + ' — ' + b.shot.launch.kph + ' km/h',
        g.w * 0.28, g.h - 26);
    }
  }

  function drawRunners(ctx, td, b, t) {
    var runs = b.field ? b.field.runs : 0;
    if (!runs && !(b.field && b.field.out && b.field.out.mode === 'run out')) return;
    var per = C.RUN_TIME;
    var prog = CG.clamp(t / per, 0, runs + 1);
    var leg = Math.floor(prog);
    var frac = prog - leg;
    var a = { x: 0, y: C.STRIKER_Y }, z = { x: 0, y: C.BOWLER_Y };
    var from = (leg % 2 === 0) ? a : z, to = (leg % 2 === 0) ? z : a;
    var p1 = td.project(CG.lerp(from.x, to.x, frac) - 1.1, CG.lerp(from.y, to.y, frac));
    var p2 = td.project(CG.lerp(to.x, from.x, frac) + 1.1, CG.lerp(to.y, from.y, frac));
    [p1, p2].forEach(function (p, i) {
      ctx.fillStyle = (g.humanRole === 'bat') ? CG.TEAM.home.primary : CG.TEAM.away.primary;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });
  }

  // ------------------------------------------------------------- figure help

  function drawFigureAt(ctx, cam, x, y, kit, pose, face, opts) {
    var p = cam.project(x, y, 0);
    if (!p.visible) return;
    var hpx = PLAYER_H * p.s;
    var o = { kit: kit, pose: pose, face: face };
    if (opts) for (var k in opts) o[k] = opts[k];
    V.drawPlayer(ctx, p.sx, p.sy, hpx, o);
  }

  function drawFielders(ctx, cam, fielders, kit, pose) {
    var items = fielders.filter(function (f) { return !f.keeper && !f.bowler; })
      .map(function (f) { return { f: f, p: cam.project(f.x, f.y, 0) }; })
      .filter(function (o) { return o.p.visible; });
    items.sort(function (a, b) { return b.p.d - a.p.d; });
    items.forEach(function (o) {
      V.drawPlayer(ctx, o.p.sx, o.p.sy, PLAYER_H * o.p.s, {
        kit: kit, pose: pose, face: o.f.y > C.STRIKER_Y ? -1 : 1, bat: false
      });
    });
  }

  /* A few frames of ball history, fading out behind it. */
  function drawBallTrail(ctx, cam, traj, t) {
    var n = 7, gap = 0.022;
    for (var i = n; i > 0; i--) {
      var tt = t - i * gap;
      if (tt < 0) continue;
      var s = CG.traj.at(traj, tt);
      var p = cam.project(s.x, s.y, s.z);
      if (!p.visible) continue;
      ctx.fillStyle = 'rgba(179,38,38,' + (0.06 + 0.055 * (n - i)) + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(2, 0.036 * p.s * 4.5) * (0.45 + 0.07 * (n - i)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBatterFigure(ctx, cam, mir) {
    var pose = 'stance';
    var b = g.ball;
    if (b) {
      if (b.rec && b.rec.wicket && g.phase === 'outcome') pose = 'dejected';
      else if (b.swingT != null && b.t >= b.swingT) pose = shotPose(b.shot ? b.shot.shotId : 'defend');
      else if (b.t > 0.08) pose = 'backlift';
    }
    if (g.phase === 'outcome' && b && b.rec && b.rec.runs >= 4) pose = 'cheer';
    drawFigureAt(ctx, cam, -0.42 * mir, C.STRIKER_Y - 0.12, CG.TEAM.home, pose, mir,
      { helmet: true, pads: true, gloves: true });
  }

  function shotPose(id) {
    return { defend: 'defend', drive: 'drive', cross: 'cut', loft: 'loft' }[id] || 'defend';
  }

  function drawBowlerFigure(ctx, cam, kit, foreground) {
    var b = g.ball;
    var y = C.BOWLER_Y + 11, pose = 'ready';
    var face = foreground ? 1 : -1;

    if (b) {
      var t = b.t;
      if (t < -0.25) {
        var k = CG.clamp((t + RUNUP_T) / (RUNUP_T - 0.25), 0, 1);
        y = CG.lerp(C.BOWLER_Y + 11, C.RELEASE_Y + 0.6, ease(k));
        pose = (Math.floor(k * 9) % 2 === 0) ? 'runup' : 'sprint';
      } else if (t < 0) { y = C.RELEASE_Y + 0.5; pose = 'gather'; }
      else if (t < 0.18) { y = C.RELEASE_Y; pose = 'release'; }
      else { y = C.RELEASE_Y - CG.clamp(t - 0.18, 0, 1.2) * 2.4; pose = 'follow'; }
      if (g.phase === 'outcome' && b.rec && b.rec.wicket) pose = 'appeal';
    }
    drawFigureAt(ctx, cam, CG.delivery.RELEASE_X * 1.3, y, kit, pose, face, { bat: false });
  }

  // --------------------------------------------------------------- overlays

  function drawMarker(ctx, cam, x, len) {
    var y = C.STRIKER_Y + len;
    var p = cam.project(x, y, 0.02);
    if (!p.visible) return;
    var rx = Math.max(16, 0.55 * p.s), ry = Math.max(6, 0.22 * p.s);
    var pulse = 0.72 + 0.28 * Math.sin(performance.now() / 260);

    ctx.fillStyle = 'rgba(224,176,42,' + (0.16 * pulse) + ')';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(28,20,4,0.55)';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,196,58,' + pulse + ')';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.sx - rx * 0.45, p.sy); ctx.lineTo(p.sx + rx * 0.45, p.sy);
    ctx.moveTo(p.sx, p.sy - ry * 0.7); ctx.lineTo(p.sx, p.sy + ry * 0.7);
    ctx.stroke();

    var label = CG.lengthName(len, true);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(10,22,40,.75)';
    V.roundRect(ctx, p.sx - tw / 2, p.sy + ry + 5, tw, 17, 5); ctx.fill();
    ctx.fillStyle = '#f0c43a';
    ctx.fillText(label, p.sx, p.sy + ry + 17);
  }

  function drawPitchMark(ctx, cam, x, y) {
    var p = cam.project(x, y, 0.02);
    if (!p.visible) return;
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, 0.17 * p.s, 0.07 * p.s, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* The arc the current stroke can send the ball into. */
  function drawAimArc(ctx, cam, mir) {
    if (g.phase !== 'setup' && g.phase !== 'runup' && g.phase !== 'flight') return;
    var shot = CG.SHOTS.drive;
    var base = (shot.az + g.inp.aim * shot.arc) * mir;
    var origin = { x: -0.42 * mir, y: C.STRIKER_Y + 0.4 };
    var a = base * CG.DEG;
    var len = 13;
    var p0 = cam.project(origin.x, origin.y, 0.03);
    var p1 = cam.project(origin.x + Math.sin(a) * len, origin.y + Math.cos(a) * len, 0.03);
    if (!p0.visible || !p1.visible) return;
    ctx.strokeStyle = 'rgba(77,134,214,.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* Practice only: the build plan keeps the timing window hidden in a match. */
  function drawTimingBar(ctx) {
    var b = g.ball;
    if (!b || b.contactT == null) return;
    var w = Math.min(420, g.w * 0.6), x = (g.w - w) / 2, y = g.h - 150;
    var span = 0.55;
    var win = g.diff.window / span;
    ctx.fillStyle = 'rgba(10,22,40,.7)';
    V.roundRect(ctx, x, y, w, 14, 7); ctx.fill();
    ctx.fillStyle = 'rgba(63,165,100,.55)';
    ctx.fillRect(x + w * (0.5 - win / 2), y, w * win, 14);
    var k = CG.clamp(0.5 + (b.t - b.contactT) / span, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * k - 1.5, y - 3, 3, 20);
  }

  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

  /* Development hooks. Lets a frame be composed and drawn without waiting for
     the loop, which is how the views are checked while tuning the cameras. */
  CG.debug = {
    g: g, draw: draw, update: update, setPhase: setPhase,
    beginBall: beginBall, commitShot: commitShot, afterBall: afterBall,
    step: function (dt, n) { for (var i = 0; i < (n || 1); i++) update(dt); draw(); },
    freeze: function (v) { g.paused = v !== false; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window.CG = window.CG || {});
