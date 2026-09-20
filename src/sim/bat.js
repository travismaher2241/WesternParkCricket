/* Shot resolution.

   Scores the delivery against what the batter actually did - footwork, shot
   family, aim and timing - picks a contact category, and only then launches
   a ball. Animation displays this result; it never decides it. */
(function (CG) {
  'use strict';

  var C = CG.C;
  var T = CG.traj;

  // Where the bat meets the ball, relative to the striker's stumps.
  var FRONT_FOOT_Y = C.STRIKER_Y + 0.70;
  var BACK_FOOT_Y  = C.STRIKER_Y - 0.38;

  // How hard a perfectly middled shot leaves the bat, before shot power and
  // contact quality scale it. Tuned against the Findex Oval boundary so a
  // middled drive is a four and a middled loft can just clear the rope.
  var POWER_MPS = 22.0;

  function contactPlane(foot) {
    return foot === 'back' ? BACK_FOOT_Y : FRONT_FOOT_Y;
  }

  function bandScore(v, lo, hi, tol) {
    if (v >= lo && v <= hi) return 1;
    var d = (v < lo) ? (lo - v) : (v - hi);
    return CG.clamp(1 - d / tol, 0, 1);
  }

  /* Footwork suitability. Front foot wants the ball up, back foot wants it
     back. The overlap in the middle is what makes good length awkward. */
  function footScore(foot, bounceD, bounced) {
    if (!bounced) return foot === 'front' ? 1 : 0.55;
    if (foot === 'front') return CG.clamp(1 - Math.max(0, bounceD - 5.8) / 3.4, 0.05, 1);
    return CG.clamp(1 - Math.max(0, 5.2 - bounceD) / 3.4, 0.05, 1);
  }

  /* Resolve one shot.

     batter: { handed, foot, aim (-1..1), shotId, power (0..1 attribute) }
     pressT: seconds after release that the player committed to the stroke. */
  function resolve(delivery, batter, pressT, diff, rng) {
    var mirror = (batter.handed === 'left') ? -1 : 1;
    var shot = CG.SHOTS[batter.shotId] || CG.SHOTS.defend;
    var planeY = contactPlane(batter.foot);

    var tIdeal = T.crossingTime(delivery.traj, planeY);
    if (tIdeal == null) tIdeal = delivery.traj.duration;

    var te = pressT - tIdeal;                     // negative = too early
    var window = diff.window;
    var ball = T.at(delivery.traj, tIdeal);
    var sx = ball.x * mirror;                     // right-hander frame
    var sz = Math.max(0.02, ball.z);

    var tQ = CG.clamp(1 - Math.abs(te) / window, 0, 1);
    var lenQ = bandScore(delivery.bounceD, shot.len[0], shot.len[1], shot.lenTol);
    var footQ = footScore(batter.foot, delivery.bounceD, delivery.bounced);
    var lineQ = bandScore(sx, shot.reachX[0], shot.reachX[1], 0.52);
    var heightQ = bandScore(sz, shot.height[0], shot.height[1], 0.48);

    var quality = 0.40 * tQ + 0.18 * lenQ + 0.14 * footQ + 0.16 * lineQ + 0.12 * heightQ;
    quality = CG.clamp(quality + rng.gauss(0, 0.028), 0, 1);

    var res = {
      shotId: shot.id,
      shotName: shot.name,
      foot: batter.foot,
      aim: batter.aim,
      timingError: te,
      timingWord: timingWord(te, window),
      quality: quality,
      scores: { timing: tQ, length: lenQ, foot: footQ, line: lineQ, height: heightQ },
      contactY: planeY,
      ballAtContact: { x: ball.x, z: sz, speed: Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy + ball.vz * ball.vz) },
      out: null,
      post: null,
      launch: null,
      aerial: false
    };

    // A swing and a miss: the bat never gets near it.
    var reachable = Math.abs(te) <= window * 1.45 && lineQ > 0.02 && heightQ > 0.02;
    if (!reachable) quality = Math.min(quality, 0.18);

    res.contact = category(quality);
    res.contactName = CG.CONTACT.filter(function (c) { return c.id === res.contact; })[0].name;

    if (res.contact === 'miss') {
      missOutcome(res, delivery, batter, mirror, rng, diff);
      return res;
    }

    launch(res, delivery, batter, shot, mirror, sx, sz, te, window, rng);
    return res;
  }

  function category(q) {
    for (var i = 0; i < CG.CONTACT.length; i++) {
      if (q >= CG.CONTACT[i].min) return CG.CONTACT[i].id;
    }
    return 'miss';
  }

  function timingWord(te, window) {
    var a = Math.abs(te);
    if (a < window * 0.28) return 'perfect';
    if (a < window * 0.62) return te < 0 ? 'slightly early' : 'slightly late';
    if (a < window) return te < 0 ? 'early' : 'late';
    return te < 0 ? 'far too early' : 'far too late';
  }

  /* Bat missed. Work out whether the stumps, the pad or the keeper got it. */
  function missOutcome(res, delivery, batter, mirror, rng, diff) {
    var sxStumps = delivery.stumpsX * mirror;
    var szStumps = delivery.stumpsZ;
    var hitsStumps = Math.abs(sxStumps) < (C.STUMP_HALF_WIDTH + 0.037) && szStumps < C.STUMP_HEIGHT;

    // The front pad sits just outside leg stump and low.
    var padX = (batter.foot === 'front') ? [-0.33, 0.04] : [-0.30, 0.02];
    var tPad = T.crossingTime(delivery.traj, contactPlane(batter.foot));
    var atPad = tPad != null ? T.at(delivery.traj, tPad) : null;
    var padHit = false;
    if (atPad) {
      var px = atPad.x * mirror;
      padHit = px > padX[0] && px < padX[1] && atPad.z < 0.86;
    }

    if (padHit) {
      var pitchedLegal = !delivery.bounced || (delivery.bounceX * mirror) > -C.STUMP_HALF_WIDTH;
      if (hitsStumps && pitchedLegal) {
        res.out = { mode: 'lbw', label: 'LBW', detail: 'Struck in front, and it was going on to hit' };
      } else if (hitsStumps) {
        res.note = 'Struck on the pad, but it pitched outside leg - not out';
        res.legBye = rng.chance(0.35) ? 1 : 0;
      } else {
        res.note = 'Thudded into the pad and dropped away';
        res.legBye = rng.chance(0.25) ? 1 : 0;
      }
      return;
    }

    if (hitsStumps) {
      res.out = { mode: 'bowled', label: 'Bowled', detail: 'Through the gate and into the stumps' };
      return;
    }

    res.note = 'Beaten - the keeper takes it';
    res.bye = rng.chance(0.12) ? 1 : 0;
  }

  /* Turn a successful contact into a ball leaving the bat. */
  function launch(res, delivery, batter, shot, mirror, sx, sz, te, window, rng) {
    var ballSpeed = res.ballAtContact.speed;
    var qp = 0.42 + 0.72 * res.quality;
    var power = shot.power * (0.85 + 0.30 * (batter.power == null ? 0.5 : batter.power));

    var speed = ballSpeed * 0.26 + POWER_MPS * power * qp;
    var elev = shot.elev;
    var az;

    // Cut or pull is one button. Which one it becomes depends on where the
    // ball actually is, not on what the player pressed.
    if (shot.id === 'cross') {
      az = (sx > 0.12) ? 64 : -58;
    } else {
      az = shot.az;
    }
    az += batter.aim * shot.arc;

    // Early contact drags the ball to the leg side, late squirts it to the
    // off side, inside the arc of the stroke the player chose.
    az += (te / window) * 26;

    if (res.contact === 'edge') {
      speed *= 0.46;
      elev = rng.range(2, 18);
      // Mostly outside edges behind square; occasionally an inside edge.
      az = rng.chance(0.74) ? rng.range(104, 176) : rng.range(-172, -118);
      res.note = (az > 0) ? 'Outside edge' : 'Inside edge';
    } else if (res.contact === 'mishit') {
      speed *= 0.62;
      elev += rng.range(14, 40);
      az += rng.range(-26, 26);
      res.note = 'Off the top half of the bat';
    } else if (res.contact === 'good') {
      speed *= 0.88;
      elev += rng.range(-3, 7);
      az += rng.range(-9, 9);
    } else {
      elev += rng.range(-2, 3);
      az += rng.range(-5, 5);
      // A middled loft is meant to go up; a middled drive is meant to stay down.
      if (shot.aerial < 0.2) elev = Math.min(elev, 16);
    }

    elev = CG.clamp(elev, -6, 72);
    speed = Math.max(3.5, speed);

    var azR = az * CG.DEG;
    var elR = elev * CG.DEG;
    var horiz = speed * Math.cos(elR);
    var vx = horiz * Math.sin(azR) * mirror;
    var vy = horiz * Math.cos(azR);
    var vz = speed * Math.sin(elR);

    var start = { x: sx * mirror, y: res.contactY, z: Math.max(0.14, sz) };

    res.launch = { speed: speed, elev: elev, az: az * mirror, kph: Math.round(speed * 3.6) };
    res.post = T.integrate(
      { x: start.x, y: start.y, z: start.z, vx: vx, vy: vy, vz: vz },
      { maxT: 8, bounceZ: 0.36, bouncePace: 0.66 }
    );
    res.aerial = true;
  }

  /* The AI batter faces the player's bowling. It reads length, picks a
     sensible stroke, then executes it with a difficulty-scaled timing error.
     Poor releases by the player show up here as easier reads. */
  function aiBat(delivery, diff, rng, state) {
    var d = delivery.bounceD;
    var handed = 'right';
    var shotId, foot;

    // Twelve balls is not an innings you can build. The AI attacks from the
    // first ball and gets wilder if the run rate demands it.
    var agg = 0.62;
    if (state && state.needRate != null) {
      agg = CG.clamp(0.45 + (state.needRate - 6) * 0.06, 0.4, 0.95);
    }
    var confused = rng.chance(diff.aiChoice);

    if (!delivery.bounced) {
      shotId = rng.chance(agg * 0.6) ? 'loft' : 'drive'; foot = 'front';
    } else if (d < 2.4) {
      shotId = rng.chance(agg * 0.55) ? 'loft' : 'drive'; foot = 'front';
    } else if (d < 5.8) {
      shotId = rng.chance(agg * 0.35) ? 'loft' : (rng.chance(0.78) ? 'drive' : 'defend');
      foot = 'front';
    } else if (d < 8.6) {
      shotId = rng.chance(0.74) ? 'cross' : 'defend'; foot = 'back';
    } else {
      shotId = rng.chance(0.82) ? 'cross' : 'defend'; foot = 'back';
    }
    if (confused) {
      shotId = rng.pick(CG.SHOT_ORDER);
      foot = rng.chance(0.5) ? 'front' : 'back';
    }

    var planeY = contactPlane(foot);
    var tIdeal = T.crossingTime(delivery.traj, planeY);
    if (tIdeal == null) tIdeal = delivery.traj.duration;

    // A well executed delivery is genuinely harder to time.
    var sd = diff.aiTiming * (1.35 - 0.5 * delivery.exec.accuracy);
    if (delivery.type === 'slower') sd *= 1.5;
    if (delivery.type === 'yorker' && d < 2.0) sd *= 1.3;

    var pressT = tIdeal + rng.gauss(0, sd);
    var aim = CG.clamp(rng.gauss(0, 0.55), -1, 1);

    return {
      batter: { handed: handed, foot: foot, aim: aim, shotId: shotId, power: 0.5 },
      pressT: pressT
    };
  }

  CG.bat = {
    resolve: resolve,
    aiBat: aiBat,
    contactPlane: contactPlane,
    FRONT_FOOT_Y: FRONT_FOOT_Y,
    BACK_FOOT_Y: BACK_FOOT_Y,
    POWER_MPS: POWER_MPS
  };

})(window.CG = window.CG || {});
