/* Ball flight.

   The whole game is built on one idea from the build plan: a delivery, and a
   shot, exist as DATA before anything is drawn. This module turns an initial
   state into a sampled trajectory. Rendering only ever looks a trajectory up
   by time, so art changes can never silently alter a cricket outcome. */
(function (CG) {
  'use strict';

  var C = CG.C;

  function outsideBoundary(x, y) {
    var ex = x / C.BOUNDARY_RX;
    var ey = y / C.BOUNDARY_RY;
    return (ex * ex + ey * ey) >= 1;
  }
  CG.outsideBoundary = outsideBoundary;

  /* Integrate a ball from `s0` = {x,y,z,vx,vy,vz}.

     opts:
       swing        lateral acceleration in m/s^2, applied before first bounce
       seam         lateral velocity kick applied at the first bounce
       bounceZ      vertical restitution override
       bouncePace   horizontal pace retained through the bounce
       stopY        stop once y drops below this (used for a delivery)
       stopOnBoundary  stop the first sample outside the rope
       maxT         hard time limit
       dt           integration step

     Returns { samples, bounceIndex, boundaryIndex, restIndex }.
     Each sample is {t,x,y,z,vx,vy,vz,bounces,rolling}. */
  function integrate(s0, opts) {
    opts = opts || {};
    var dt = opts.dt || 1 / 240;
    var maxT = opts.maxT || 7;
    var swing = opts.swing || 0;
    var seam = opts.seam || 0;
    var bZ = (opts.bounceZ != null) ? opts.bounceZ : C.BOUNCE_Z;
    var bP = (opts.bouncePace != null) ? opts.bouncePace : C.BOUNCE_PACE;
    var drag = (opts.drag != null) ? opts.drag : C.DRAG;

    var x = s0.x, y = s0.y, z = s0.z;
    var vx = s0.vx, vy = s0.vy, vz = s0.vz;
    var t = 0, bounces = 0, rolling = false;

    var samples = [];
    var bounceIndex = -1, boundaryIndex = -1, restIndex = -1;

    samples.push({ t: 0, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, bounces: 0, rolling: false });

    while (t < maxT) {
      var sp = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (rolling) {
        var decay = Math.exp(-C.ROLL_FRICTION * dt);
        vx *= decay; vy *= decay; vz = 0;
        x += vx * dt; y += vy * dt; z = 0;
      } else {
        // Drag opposes motion; swing is a steady sideways push in the air.
        var ax = -drag * sp * vx + (bounces === 0 ? swing : 0);
        var ay = -drag * sp * vy;
        var az = -drag * sp * vz - C.GRAVITY;
        vx += ax * dt; vy += ay * dt; vz += az * dt;
        x += vx * dt; y += vy * dt; z += vz * dt;

        if (z <= 0) {
          z = 0;
          if (bounces === 0) {
            bounceIndex = samples.length;
            vx += seam;
          }
          bounces++;
          vz = -vz * bZ;
          vx *= bP; vy *= bP;
          if (vz < 0.55) { vz = 0; rolling = true; }
        }
      }

      t += dt;
      var s = { t: t, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, bounces: bounces, rolling: rolling };
      samples.push(s);

      if (boundaryIndex < 0 && outsideBoundary(x, y)) {
        boundaryIndex = samples.length - 1;
        if (opts.stopOnBoundary) break;
      }
      if (opts.stopY != null && y <= opts.stopY) break;
      if (rolling && Math.sqrt(vx * vx + vy * vy) < 0.35) { restIndex = samples.length - 1; break; }
    }

    if (restIndex < 0) restIndex = samples.length - 1;

    return {
      samples: samples,
      bounceIndex: bounceIndex,
      boundaryIndex: boundaryIndex,
      restIndex: restIndex,
      duration: samples[samples.length - 1].t
    };
  }

  /* Linear lookup by time. Clamps at both ends. */
  function at(traj, t) {
    var s = traj.samples;
    if (t <= 0) return s[0];
    var last = s[s.length - 1];
    if (t >= last.t) return last;
    // Samples are evenly spaced, so index directly rather than searching.
    var dt = s[1].t - s[0].t;
    var i = Math.floor(t / dt);
    if (i >= s.length - 1) return last;
    var a = s[i], b = s[i + 1];
    var f = (t - a.t) / (b.t - a.t);
    return {
      t: t,
      x: CG.lerp(a.x, b.x, f), y: CG.lerp(a.y, b.y, f), z: CG.lerp(a.z, b.z, f),
      vx: CG.lerp(a.vx, b.vx, f), vy: CG.lerp(a.vy, b.vy, f), vz: CG.lerp(a.vz, b.vz, f),
      bounces: a.bounces, rolling: a.rolling
    };
  }

  /* First time the ball's y crosses `planeY` moving down the pitch.
     Returns null if it never gets there. */
  function crossingTime(traj, planeY) {
    var s = traj.samples;
    for (var i = 1; i < s.length; i++) {
      if (s[i - 1].y > planeY && s[i].y <= planeY) {
        var f = (s[i - 1].y - planeY) / (s[i - 1].y - s[i].y);
        return CG.lerp(s[i - 1].t, s[i].t, f);
      }
    }
    return null;
  }

  CG.traj = { integrate: integrate, at: at, crossingTime: crossingTime };

})(window.CG = window.CG || {});
