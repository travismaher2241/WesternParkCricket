/* Delivery generation.

   A delivery is a plan (type, line, length), an execution (pace, release
   accuracy) and the resulting trajectory. The plan and the execution are
   recorded separately so the ball log can explain WHY a ball went where it
   went - the build plan's readability requirement. */
(function (CG) {
  'use strict';

  var C = CG.C;
  var T = CG.traj;

  // Right-arm over the wicket: the hand is slightly to the off side of the
  // stumps at the bowler's end.
  var RELEASE_X = 0.38;

  /* Fire a ball from the release point. `dt` is coarse while solving and
     fine for the delivery that is actually bowled. */
  function shoot(vx, vy, vz, spec, releaseX, dt) {
    return T.integrate(
      { x: releaseX, y: C.RELEASE_Y, z: C.RELEASE_Z, vx: vx, vy: vy, vz: vz },
      {
        swing: spec.swing,
        seam: spec.seam,
        bounceZ: C.BOUNCE_Z + (spec.bounceBoost || 0),
        stopY: C.STRIKER_Y - 4.0,
        maxT: 3.0,
        dt: dt
      }
    );
  }

  function pitchPoint(traj) {
    if (traj.bounceIndex < 0) return null;
    return traj.samples[traj.bounceIndex];
  }

  /* Where does this release pitch? Returns the bounce y, or -Infinity if it
     carried past the batter without bouncing (i.e. it went "too far"). */
  function pitchY(vx, vy, vz, spec, releaseX) {
    var p = pitchPoint(shoot(vx, vy, vz, spec, releaseX, 1 / 120));
    return p ? p.y : -Infinity;
  }

  /* Aim the ball at a landing spot.

     Drag, swing and the release height all move the pitch mark, so there is
     no closed form worth trusting. Bounce y falls monotonically as the
     release angle rises, so bisect on vz - it converges for a yorker and for
     a bouncer alike, which the old gradient step did not. */
  function aim(speed, landX, landY, spec, releaseX) {
    var dx = landX - releaseX;
    var dy = C.RELEASE_Y - landY;
    var horiz = Math.sqrt(dx * dx + dy * dy);
    var tFlight = horiz / speed;

    var vy = -dy / tFlight;
    var vx = dx / tFlight;
    var vz = 0;

    for (var pass = 0; pass < 2; pass++) {
      var lo = -9, hi = 5;                  // vz bracket: steepest to loopiest
      for (var i = 0; i < 18; i++) {
        var mid = (lo + hi) / 2;
        if (pitchY(vx, vy, mid, spec, releaseX) > landY) lo = mid;  // pitched short
        else hi = mid;
      }
      vz = (lo + hi) / 2;

      var p = pitchPoint(shoot(vx, vy, vz, spec, releaseX, 1 / 120));
      if (!p) break;
      vx -= (p.x - landX) / Math.max(0.2, p.t);
    }

    return { traj: shoot(vx, vy, vz, spec, releaseX, 1 / 240), vx: vx, vy: vy, vz: vz };
  }

  /* Build a delivery.

     plan: { type, lineX, lengthD }   lengthD = metres up the pitch from the
                                      striker's stumps
     exec: { pace, accuracy }         both 0..1
  */
  function make(plan, exec, diff, rng, handed) {
    var spec = CG.DELIVERIES[plan.type] || CG.DELIVERIES.stock;
    var mirror = (handed === 'left') ? -1 : 1;

    var pace = CG.clamp(exec.pace, 0, 1);
    var acc = CG.clamp(exec.accuracy, 0, 1);
    var speed = CG.lerp(spec.speed[0], spec.speed[1], pace) * spec.paceMeter * diff.speedMul;

    // Release error. Each delivery type fails in its own direction: a missed
    // yorker slides under the intended mark and becomes a full toss, a missed
    // bouncer climbs.
    var slip = (1 - acc);
    var radius = spec.missRadius * slip * diff.missRadiusMul;
    var lenErr = rng.gauss(0, radius * 0.62) + spec.lengthBias * slip * 1.35;
    var lineErr = rng.gauss(0, radius * 0.42) + spec.lineBias * slip * 1.15;

    var wantLen = plan.lengthD;
    var wantX = plan.lineX * mirror;

    var landY = C.STRIKER_Y + Math.max(-1.2, wantLen + lenErr);
    var landX = CG.clamp(wantX + lineErr * mirror, -2.6, 2.6);

    var releaseX = RELEASE_X * mirror;
    var shot = aim(speed, landX, landY, spec, releaseX);
    var traj = shot.traj;

    var pitch = pitchPoint(traj);
    var bounced = !!pitch;
    var bounceD = bounced ? (pitch.y - C.STRIKER_Y) : -1;

    // What the ball is doing as it reaches the stumps.
    var tStumps = T.crossingTime(traj, C.STRIKER_Y);
    var atStumps = tStumps != null ? T.at(traj, tStumps) : traj.samples[traj.samples.length - 1];

    var d = {
      type: spec.id,
      typeName: spec.name,
      plan: { lineX: wantX, lengthD: wantLen },
      exec: { pace: pace, accuracy: acc },
      speed: speed,
      speedKph: Math.round(speed * 3.6),
      swing: spec.swing * mirror,
      handed: handed,
      traj: traj,
      bounced: bounced,
      bounceD: bounceD,
      bounceX: bounced ? pitch.x : landX,
      bounceT: bounced ? pitch.t : null,
      lengthName: CG.lengthName(bounceD, bounced),
      lineName: CG.lineName(atStumps.x, handed),
      stumpsX: atStumps.x,
      stumpsZ: atStumps.z,
      tStumps: tStumps,
      lenError: lenErr,
      lineError: lineErr
    };

    d.illegal = legality(d, mirror);
    return d;
  }

  /* Wides and no-balls. Kept deliberately simple: one wide line each side,
     plus the beamer rule that makes a badly missed yorker genuinely risky. */
  function legality(d, mirror) {
    var sx = d.stumpsX * mirror;    // in right-hander terms
    if (!d.bounced && d.stumpsZ > 1.32) {
      return { type: 'noball', label: 'No ball - full toss above the waist', runs: 1, rebowl: true };
    }
    if (d.bounced && d.stumpsZ > 1.95) {
      return { type: 'wide', label: 'Wide - bounced over the batter', runs: 1, rebowl: true };
    }
    if (sx > 1.05) {
      return { type: 'wide', label: 'Wide outside off', runs: 1, rebowl: true };
    }
    if (sx < -0.88) {
      return { type: 'wide', label: 'Wide down the leg side', runs: 1, rebowl: true };
    }
    return null;
  }

  /* The AI bowler in Liam's batting innings. It has a plan, it mostly
     executes it, and it gets a little braver at the death. */
  function aiPlan(rng, diff, state) {
    var types = ['stock', 'stock', 'outswing', 'inswing', 'slower'];
    if (state.ballsLeft <= 4) types.push('yorker', 'bouncer');
    if (state.runsThisOver >= 8) types.push('slower', 'bouncer');
    var type = rng.pick(types);

    var lengthD = rng.gauss(5.4, 1.5);
    if (type === 'yorker') lengthD = rng.gauss(1.3, 0.5);
    if (type === 'bouncer') lengthD = rng.gauss(9.4, 0.8);
    if (type === 'slower') lengthD = rng.gauss(4.6, 1.2);

    var lineX = rng.gauss(0.18, 0.22);
    if (type === 'inswing') lineX = rng.gauss(-0.10, 0.20);
    if (type === 'outswing') lineX = rng.gauss(0.32, 0.22);

    var skill = 1 - diff.aiChoice * 0.5;
    return {
      plan: { type: type, lineX: lineX, lengthD: CG.clamp(lengthD, -0.6, 12.5) },
      exec: {
        pace: CG.clamp(rng.gauss(0.62, 0.20), 0, 1),
        accuracy: CG.clamp(rng.gauss(skill, 0.14), 0.15, 1)
      }
    };
  }

  CG.delivery = { make: make, aiPlan: aiPlan, RELEASE_X: RELEASE_X };

})(window.CG = window.CG || {});
