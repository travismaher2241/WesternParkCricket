/* Cameras and figure drawing.

   Two projections. A pinhole camera for the two gameplay views down the
   pitch, and a flat top-down map for the ball-in-play view. The top-down map
   is also the ground truth the simulation works in, which is why the ball
   never disagrees with itself between cameras.

   Players are grey-box figures built from a small skeleton. They are a
   placeholder for the sprite sheets in the build plan, but they carry the
   right kit colours, the right handedness and the right poses, so the sprite
   work can drop straight in behind them. */
(function (CG) {
  'use strict';

  var C = CG.C;
  var P = CG.PALETTE;

  // ------------------------------------------------------------------ camera

  function Camera() {
    this.x = 0; this.y = 0; this.z = 3;
    this.dir = 1;          // +1 looks down the pitch (+y), -1 looks back
    this.f = 700;
    this.horizon = 300;
    this.cx = 640;
    this.shakeX = 0; this.shakeY = 0;
  }

  Camera.prototype.setBehindBatter = function (w, h, mirror) {
    this.dir = 1;
    this.x = 0.90 * mirror;
    this.y = C.STRIKER_Y - 17.0;
    this.z = 4.20;
    // Short landscape screens need a wider lens or the batter drops off the
    // bottom of the frame, so the focal length is capped by height as well.
    this.f = Math.min(w * 1.15, h * 2.1);
    this.cx = w * 0.5;
    this.horizon = h * 0.44;
  };

  Camera.prototype.setBehindBowler = function (w, h, mirror) {
    this.dir = -1;
    this.x = -0.75 * mirror;
    this.y = C.BOWLER_Y + 24.0;
    this.z = 4.30;
    this.f = Math.min(w * 1.30, h * 2.4);
    this.cx = w * 0.5;
    this.horizon = h * 0.44;
  };

  /* World point -> screen. `d` is depth in metres; anything at or behind the
     camera plane is flagged invisible rather than wrapped around. */
  Camera.prototype.project = function (x, y, z) {
    var d = (y - this.y) * this.dir;
    if (d < 0.35) return { visible: false, d: d, sx: 0, sy: 0, s: 0 };
    var s = this.f / d;
    return {
      visible: true,
      d: d,
      s: s,
      sx: this.cx + (x - this.x) * s * this.dir + this.shakeX,
      sy: this.horizon - (z - this.z) * s + this.shakeY
    };
  };

  // ---------------------------------------------------------------- top-down

  function TopDown() { this.cx = 640; this.cy = 360; this.mpp = 6; }

  TopDown.prototype.fit = function (w, h) {
    // Show the junior boundary with a margin, oriented with the bowler's end
    // at the top of the screen.
    var pad = 1.16;
    this.mpp = Math.min(w / (C.BOUNDARY_RX * 2 * pad), h / (C.BOUNDARY_RY * 2 * pad));
    this.cx = w * 0.5;
    this.cy = h * 0.5;
  };

  TopDown.prototype.project = function (x, y, z) {
    return {
      visible: true,
      sx: this.cx + x * this.mpp,
      sy: this.cy - y * this.mpp,
      s: this.mpp,
      z: z || 0
    };
  };

  // ----------------------------------------------------------------- figures

  /* A pose is joint angles in degrees, measured from straight down and
     rotating toward the figure's facing direction. */
  var POSES = {
    stance:   { lean: -6, legs: [[-16, 10], [14, -8]], arms: [[168, 34], [162, 28]], bat: 196 },
    walk:     { lean: 2,  legs: [[22, -14], [-22, 16]], arms: [[-24, 12], [26, -10]], bat: null },
    ready:    { lean: 8,  legs: [[-18, 14], [18, -12]], arms: [[-34, 44], [34, -44]], bat: null },
    sprint:   { lean: 18, legs: [[40, -30], [-38, 34]], arms: [[-52, 40], [54, -38]], bat: null },
    runup:    { lean: 14, legs: [[36, -26], [-34, 30]], arms: [[-46, 36], [128, -20]], bat: null },
    gather:   { lean: -4, legs: [[-24, 18], [26, -16]], arms: [[172, 10], [152, 20]], bat: null },
    release:  { lean: 16, legs: [[34, -24], [-30, 26]], arms: [[26, 8], [196, -12]], bat: null },
    follow:   { lean: 24, legs: [[44, -32], [-24, 20]], arms: [[62, 20], [-84, 24]], bat: null },
    defend:   { lean: 10, legs: [[-34, 26], [18, -12]], arms: [[8, 24], [14, 18]], bat: 16 },
    drive:    { lean: 12, legs: [[-40, 30], [22, -14]], arms: [[46, 26], [52, 20]], bat: 74 },
    cut:      { lean: -4, legs: [[-10, 8], [26, -18]], arms: [[96, 18], [88, 24]], bat: 122 },
    loft:     { lean: -8, legs: [[-36, 26], [20, -12]], arms: [[70, -34], [76, -28]], bat: 138 },
    backlift: { lean: -8, legs: [[-16, 10], [14, -8]], arms: [[186, 24], [180, 18]], bat: 214 },
    keeper:   { lean: 22, legs: [[-30, 46], [30, -46]], arms: [[-18, 56], [18, -56]], bat: null },
    cheer:    { lean: -4, legs: [[-18, 12], [18, -10]], arms: [[184, -18], [176, 18]], bat: 200 },
    appeal:   { lean: -6, legs: [[-14, 10], [14, -8]], arms: [[188, -8], [184, 8]], bat: null },
    dejected: { lean: 26, legs: [[-12, 8], [12, -6]], arms: [[18, 40], [-16, 42]], bat: 30 }
  };
  CG.POSES = POSES;

  function limb(ctx, x, y, len, a1, len2, a2, w, colour, face) {
    var r1 = a1 * CG.DEG * face;
    var kx = x + Math.sin(r1) * len;
    var ky = y + Math.cos(r1) * len;
    var r2 = (a1 + a2) * CG.DEG * face;
    var ex = kx + Math.sin(r2) * len2;
    var ey = ky + Math.cos(r2) * len2;
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey);
    ctx.stroke();
    return { x: ex, y: ey };
  }

  /* Draw a player standing at screen position (sx, syFeet), `hpx` tall.
     opts: { kit, pose, face (1|-1), helmet, pads, bat, name } */
  function drawPlayer(ctx, sx, syFeet, hpx, opts) {
    if (hpx < 4) return;
    var pose = POSES[opts.pose] || POSES.ready;
    var kit = opts.kit || CG.TEAM.home;
    var face = opts.face || 1;
    var h = hpx;

    var hipY = syFeet - h * 0.50;
    var shoulderY = syFeet - h * 0.80;
    var headY = syFeet - h * 0.895;
    var headR = h * 0.082;
    var lean = pose.lean * CG.DEG * face;
    var leanX = Math.sin(lean) * h * 0.30;

    ctx.save();

    // Shadow anchors the figure to the ground.
    ctx.fillStyle = 'rgba(12,32,16,0.26)';
    ctx.beginPath();
    ctx.ellipse(sx, syFeet, h * 0.20, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    var legLen = h * 0.25;
    var armLen = h * 0.20;
    var trouser = opts.pads ? P.white : kit.secondary;
    var padCol = opts.pads ? '#e9e6dc' : null;

    // Back leg and back arm first so the torso overlaps them.
    limb(ctx, sx, hipY, legLen, pose.legs[1][0], legLen, pose.legs[1][1], h * 0.075, shade(trouser, -0.18), face);
    var backHand = limb(ctx, sx + leanX, shoulderY, armLen, pose.arms[1][0], armLen, pose.arms[1][1], h * 0.055, shade(kit.primary, -0.2), face);

    if (padCol) {
      drawPad(ctx, sx, hipY, legLen, pose.legs[1], h, face, shade(padCol, -0.12));
    }

    // Torso.
    ctx.fillStyle = kit.primary;
    ctx.strokeStyle = shade(kit.primary, -0.3);
    ctx.lineWidth = Math.max(1, h * 0.012);
    roundRect(ctx, sx - h * 0.095 + leanX * 0.4, shoulderY, h * 0.19, hipY - shoulderY + h * 0.04, h * 0.05);
    ctx.fill(); ctx.stroke();

    // Club trim across the chest.
    ctx.fillStyle = kit.trim;
    ctx.fillRect(sx - h * 0.095 + leanX * 0.4, shoulderY + h * 0.07, h * 0.19, h * 0.028);

    // Front leg, front arm.
    limb(ctx, sx, hipY, legLen, pose.legs[0][0], legLen, pose.legs[0][1], h * 0.078, trouser, face);
    if (padCol) drawPad(ctx, sx, hipY, legLen, pose.legs[0], h, face, padCol);
    var frontHand = limb(ctx, sx + leanX, shoulderY, armLen, pose.arms[0][0], armLen, pose.arms[0][1], h * 0.058, kit.primary, face);

    // Head, then cap or helmet.
    ctx.fillStyle = '#e8b98f';
    ctx.beginPath();
    ctx.arc(sx + leanX, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    if (opts.helmet) {
      ctx.fillStyle = kit.primary;
      ctx.beginPath();
      ctx.arc(sx + leanX, headY, headR * 1.16, Math.PI * 0.92, Math.PI * 2.16);
      ctx.fill();
      ctx.strokeStyle = '#3a4250';
      ctx.lineWidth = Math.max(1, h * 0.016);
      ctx.beginPath();
      ctx.moveTo(sx + leanX - headR * 1.1 * face, headY + headR * 0.28);
      ctx.lineTo(sx + leanX + headR * 1.25 * face, headY + headR * 0.52);
      ctx.stroke();
    } else if (opts.cap !== false) {
      ctx.fillStyle = kit.primary;
      ctx.beginPath();
      ctx.arc(sx + leanX, headY - headR * 0.12, headR * 1.06, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx + leanX, headY - headR * 0.24, headR * 1.5 * face, headR * 0.34);
    }

    // Bat.
    if (pose.bat != null && opts.bat !== false) {
      var a = pose.bat * CG.DEG * face;
      var bl = h * 0.34;
      var bx = frontHand.x, by = frontHand.y;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(-a + Math.PI);
      ctx.fillStyle = '#d9c08c';
      ctx.fillRect(-h * 0.018, 0, h * 0.036, bl * 0.42);
      ctx.fillStyle = '#e8d6ac';
      ctx.strokeStyle = '#a8894f';
      ctx.lineWidth = Math.max(1, h * 0.01);
      roundRect(ctx, -h * 0.042, bl * 0.42, h * 0.084, bl * 0.58, h * 0.012);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (opts.gloves) {
      ctx.fillStyle = '#efe9d8';
      ctx.beginPath(); ctx.arc(frontHand.x, frontHand.y, h * 0.042, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(backHand.x, backHand.y, h * 0.042, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  function drawPad(ctx, sx, hipY, legLen, angles, h, face, colour) {
    var r1 = angles[0] * CG.DEG * face;
    var kx = sx + Math.sin(r1) * legLen;
    var ky = hipY + Math.cos(r1) * legLen;
    var r2 = (angles[0] + angles[1]) * CG.DEG * face;
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(-r2);
    ctx.fillStyle = colour;
    ctx.strokeStyle = 'rgba(80,80,70,0.5)';
    ctx.lineWidth = Math.max(1, h * 0.008);
    roundRect(ctx, -h * 0.055, 0, h * 0.10, legLen * 0.98, h * 0.02);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    function f(v) { return Math.round(CG.clamp(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt, 0, 255)); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  CG.view = {
    Camera: Camera,
    TopDown: TopDown,
    drawPlayer: drawPlayer,
    roundRect: roundRect,
    shade: shade
  };

})(window.CG = window.CG || {});
