/* Findex Oval.

   A simplified but deliberately recognisable version of Liam's home ground:
   a football oval with cricket played across the middle of it. The football
   shape, the goal posts, the light towers, the scoreboard, the clubrooms and
   the practice nets are all here as grey-box landmarks, positioned on the
   landmark map so painted artwork can replace each one in place.

   The landmark map now follows the user's aerial photographs of Western Park
   Reserve: clubrooms and water tank on the western side, the indoor centre
   away to the north-east, trees heaviest to the east and south. Distances
   between them are still estimates read off the aerial, not survey figures,
   and the shapes remain grey boxes awaiting the photographs listed in
   docs/REFERENCE-SHOTLIST.md. */
(function (CG) {
  'use strict';

  var C = CG.C;
  var P = CG.PALETTE;
  var V = CG.view;

  // Landmark map. Metres, with the pitch centre at the origin.
  var OVAL = {
    fenceRX: 58,
    fenceRY: 74,
    goals: [74, -74],
    lights: [[-64, 58], [64, 58], [-64, -58], [64, -58]],
    pavilion: { x: -64, y: 14, w: 30, d: 9, h: 6.5 },
    tank: { x: -76, y: 38, w: 7, d: 7, h: 7.5 },
    indoor: { x: 76, y: 54, w: 20, d: 34, h: 9.5 },
    scoreboard: { x: 26, y: 84, w: 9.5, h: 5.5, legs: 3.2 },
    nets: { x: 56, y: 26, len: 18, h: 3.4 }
  };
  CG.OVAL = OVAL;

  function treeRing() {
    var t = [];
    var rng = new CG.Rng(7712);
    for (var a = 0; a < Math.PI * 2; a += 0.085) {
      var rx = OVAL.fenceRX + rng.range(6, 22);
      var ry = OVAL.fenceRY + rng.range(6, 26);
      t.push({
        x: Math.cos(a) * rx, y: Math.sin(a) * ry,
        h: rng.range(6, 13), w: rng.range(3.5, 7),
        tone: rng.range(0, 1)
      });
    }
    return t;
  }
  var TREES = treeRing();

  // ------------------------------------------------------------------- sky

  function drawSky(ctx, w, h, cam, dusk) {
    var g = ctx.createLinearGradient(0, 0, 0, cam.horizon + 40);
    if (dusk) {
      g.addColorStop(0, '#2f4f7d');
      g.addColorStop(0.55, '#7e97b8');
      g.addColorStop(1, '#e6c39a');
    } else {
      g.addColorStop(0, '#5b9fd4');
      g.addColorStop(0.6, '#a5cde9');
      g.addColorStop(1, '#dcebf3');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, cam.horizon + 42);

    // Low evening sun behind the western side of the ground.
    var sun = cam.project(-70, 60, 12);
    if (sun.visible && dusk) {
      var rg = ctx.createRadialGradient(sun.sx, sun.sy, 0, sun.sx, sun.sy, w * 0.26);
      rg.addColorStop(0, 'rgba(255,224,170,0.85)');
      rg.addColorStop(1, 'rgba(255,224,170,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, cam.horizon + 42);
    }
  }

  // ---------------------------------------------------------------- ground

  function drawTurf(ctx, w, h, cam) {
    var g = ctx.createLinearGradient(0, cam.horizon, 0, h);
    g.addColorStop(0, P.grassDk);
    g.addColorStop(0.35, P.grass);
    g.addColorStop(1, P.grassLt);
    ctx.fillStyle = g;
    ctx.fillRect(0, cam.horizon, w, h - cam.horizon);

    // Mown stripes across the ground, drawn as projected bands.
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ffffff';
    for (var k = -14; k < 16; k += 2) {
      var y0 = k * 6, y1 = y0 + 6;
      var a = cam.project(-80, y0, 0), b = cam.project(80, y0, 0);
      var cpt = cam.project(80, y1, 0), d = cam.project(-80, y1, 0);
      if (!a.visible || !b.visible || !cpt.visible || !d.visible) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(cpt.sx, cpt.sy); ctx.lineTo(d.sx, d.sy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function ellipsePoints(rx, ry, steps) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
  }

  function strokeGroundEllipse(ctx, cam, rx, ry, z, colour, width) {
    var pts = ellipsePoints(rx, ry, 120);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    var drawing = false;
    for (var i = 0; i < pts.length; i++) {
      var p = cam.project(pts[i].x, pts[i].y, z || 0);
      if (!p.visible) { drawing = false; continue; }
      if (!drawing) { ctx.moveTo(p.sx, p.sy); drawing = true; }
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------- landmarks

  function box(ctx, cam, x, y, w, d, hgt, base, faceCol, topCol) {
    // Axis-aligned block, drawn from its projected corners.
    var c = [
      cam.project(x - w / 2, y - d / 2, base),
      cam.project(x + w / 2, y - d / 2, base),
      cam.project(x + w / 2, y - d / 2, base + hgt),
      cam.project(x - w / 2, y - d / 2, base + hgt)
    ];
    if (!c[0].visible || !c[1].visible) return null;
    ctx.fillStyle = faceCol;
    ctx.beginPath();
    ctx.moveTo(c[0].sx, c[0].sy); ctx.lineTo(c[1].sx, c[1].sy);
    ctx.lineTo(c[2].sx, c[2].sy); ctx.lineTo(c[3].sx, c[3].sy);
    ctx.closePath(); ctx.fill();
    if (topCol) {
      ctx.fillStyle = topCol;
      ctx.fillRect(Math.min(c[3].sx, c[2].sx), Math.min(c[3].sy, c[2].sy) - 3,
        Math.abs(c[2].sx - c[3].sx), 4);
    }
    return c;
  }

  function drawTrees(ctx, cam) {
    var items = TREES.map(function (t) {
      return { t: t, p: cam.project(t.x, t.y, 0) };
    }).filter(function (o) { return o.p.visible; });
    items.sort(function (a, b) { return b.p.d - a.p.d; });

    items.forEach(function (o) {
      var p = o.p, t = o.t;
      var top = cam.project(t.x, t.y, t.h);
      if (!top.visible) return;
      var wpx = t.w * p.s * 0.5;
      var hpx = p.sy - top.sy;
      if (hpx < 2) return;
      ctx.fillStyle = '#4a3222';
      ctx.fillRect(p.sx - wpx * 0.12, p.sy - hpx * 0.42, wpx * 0.24, hpx * 0.42);
      ctx.fillStyle = t.tone > 0.55 ? '#2f5f38' : '#386b3c';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - hpx * 0.66, wpx, hpx * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLightTower(ctx, cam, x, y) {
    var base = cam.project(x, y, 0);
    var top = cam.project(x, y, 17);
    if (!base.visible || !top.visible) return;
    var w = Math.max(1.5, 1.0 * base.s * 0.5);
    ctx.strokeStyle = '#7d8592';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(base.sx - w, base.sy); ctx.lineTo(top.sx, top.sy);
    ctx.moveTo(base.sx + w, base.sy); ctx.lineTo(top.sx, top.sy);
    ctx.stroke();
    // Light bank.
    ctx.fillStyle = '#5c646f';
    var bw = Math.max(4, 6 * base.s * 0.5);
    ctx.fillRect(top.sx - bw / 2, top.sy - bw * 0.35, bw, bw * 0.4);
    ctx.fillStyle = 'rgba(255,248,210,0.9)';
    for (var i = 0; i < 4; i++) {
      ctx.fillRect(top.sx - bw / 2 + i * bw / 4 + 1, top.sy - bw * 0.3, bw / 4 - 2, bw * 0.22);
    }
  }

  function drawGoalPosts(ctx, cam, y) {
    var xs = [-6.4, -3.2, 3.2, 6.4];
    var hs = [6.4, 10.5, 10.5, 6.4];
    ctx.strokeStyle = P.white;
    for (var i = 0; i < xs.length; i++) {
      var b = cam.project(xs[i], y, 0);
      var t = cam.project(xs[i], y, hs[i]);
      if (!b.visible || !t.visible) continue;
      ctx.lineWidth = Math.max(1.2, 0.4 * b.s * 0.5);
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy); ctx.lineTo(t.sx, t.sy);
      ctx.stroke();
    }
  }

  function drawScoreboard(ctx, cam, score) {
    var sb = OVAL.scoreboard;
    var b = cam.project(sb.x, sb.y, 0);
    if (!b.visible) return;
    // Legs.
    ctx.strokeStyle = '#6a5a48';
    ctx.lineWidth = Math.max(1.5, 0.5 * b.s * 0.5);
    [-sb.w * 0.35, sb.w * 0.35].forEach(function (dx) {
      var lb = cam.project(sb.x + dx, sb.y, 0);
      var lt = cam.project(sb.x + dx, sb.y, sb.legs);
      if (lb.visible && lt.visible) {
        ctx.beginPath(); ctx.moveTo(lb.sx, lb.sy); ctx.lineTo(lt.sx, lt.sy); ctx.stroke();
      }
    });
    var c = box(ctx, cam, sb.x, sb.y, sb.w, 1.2, sb.h, sb.legs, '#20262f', '#3b4453');
    if (!c) return;
    // Digits.
    var left = Math.min(c[0].sx, c[3].sx), right = Math.max(c[1].sx, c[2].sx);
    var top = Math.min(c[2].sy, c[3].sy), bot = Math.max(c[0].sy, c[1].sy);
    var wpx = right - left, hpx = bot - top;
    if (wpx < 14) return;
    ctx.fillStyle = '#e3c15a';
    ctx.font = 'bold ' + Math.max(7, hpx * 0.34) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score || '', left + wpx / 2, top + hpx * 0.46);
    ctx.fillStyle = '#9aa6b5';
    ctx.font = Math.max(6, hpx * 0.18) + 'px "Courier New", monospace';
    ctx.fillText('WESTERN PARK', left + wpx / 2, top + hpx * 0.80);
  }

  function drawPavilion(ctx, cam) {
    var pv = OVAL.pavilion;
    box(ctx, cam, pv.x, pv.y, pv.w, pv.d, pv.h, 0, '#cbc3b4', '#8d4a3a');
    // Verandah posts.
    var b = cam.project(pv.x, pv.y - pv.d / 2, 0);
    if (!b.visible) return;
    ctx.strokeStyle = '#8b8172';
    ctx.lineWidth = Math.max(1, 0.25 * b.s * 0.5);
    for (var i = -3; i <= 3; i++) {
      var lb = cam.project(pv.x + i * pv.w / 7, pv.y - pv.d / 2 - 1.6, 0);
      var lt = cam.project(pv.x + i * pv.w / 7, pv.y - pv.d / 2 - 1.6, 3.0);
      if (lb.visible && lt.visible) {
        ctx.beginPath(); ctx.moveTo(lb.sx, lb.sy); ctx.lineTo(lt.sx, lt.sy); ctx.stroke();
      }
    }
  }

  // The indoor centre beyond the north-eastern fence and the clubrooms' water
  // tank on the north-western corner: the two landmarks that place the ground
  // at a glance from the middle.
  function drawOutbuildings(ctx, cam) {
    var ic = OVAL.indoor, tk = OVAL.tank;
    box(ctx, cam, ic.x, ic.y, ic.w, ic.d, ic.h, 0, '#dfe3e2', '#c4cbcc');
    box(ctx, cam, tk.x, tk.y, tk.w, tk.d, tk.h, 0, '#d4d0ba', '#e6e2cf');
  }

  function drawNets(ctx, cam) {
    var n = OVAL.nets;
    var b = cam.project(n.x, n.y, 0);
    if (!b.visible) return;
    ctx.strokeStyle = 'rgba(70,90,80,0.55)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = n.y - n.len / 2 + (i * n.len / 4);
      var lb = cam.project(n.x, y, 0);
      var lt = cam.project(n.x, y, n.h);
      if (lb.visible && lt.visible) {
        ctx.beginPath(); ctx.moveTo(lb.sx, lb.sy); ctx.lineTo(lt.sx, lt.sy); ctx.stroke();
      }
    }
    var a1 = cam.project(n.x, n.y - n.len / 2, n.h);
    var a2 = cam.project(n.x, n.y + n.len / 2, n.h);
    if (a1.visible && a2.visible) {
      ctx.beginPath(); ctx.moveTo(a1.sx, a1.sy); ctx.lineTo(a2.sx, a2.sy); ctx.stroke();
    }
  }

  function drawFence(ctx, cam) {
    // White picket fence around the football oval, plus advertising boards.
    var pts = ellipsePoints(OVAL.fenceRX, OVAL.fenceRY, 150);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = cam.project(pts[i].x, pts[i].y, 0);
      var t = cam.project(pts[i].x, pts[i].y, 1.05);
      if (!a.visible || !t.visible) continue;
      var boardish = (i % 11) < 5;
      ctx.fillStyle = boardish ? 'rgba(27,79,156,0.75)' : P.white;
      var w = Math.max(1, 0.9 * a.s * 0.5);
      ctx.fillRect(a.sx - w / 2, t.sy, w, a.sy - t.sy);
    }
    strokeGroundEllipse(ctx, cam, OVAL.fenceRX, OVAL.fenceRY, 1.05, 'rgba(255,255,255,0.8)', 1.5);
  }

  function drawBoundaryRope(ctx, cam) {
    strokeGroundEllipse(ctx, cam, C.BOUNDARY_RX, C.BOUNDARY_RY, 0.02, 'rgba(255,255,255,0.92)', 2.2);
    // Junior boundary cones.
    var pts = ellipsePoints(C.BOUNDARY_RX, C.BOUNDARY_RY, 44);
    ctx.fillStyle = '#f0f3f7';
    for (var i = 0; i < pts.length; i++) {
      var p = cam.project(pts[i].x, pts[i].y, 0);
      var t = cam.project(pts[i].x, pts[i].y, 0.32);
      if (!p.visible || !t.visible) continue;
      var w = Math.max(1.2, 0.3 * p.s * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.sx - w, p.sy); ctx.lineTo(p.sx + w, p.sy); ctx.lineTo(t.sx, t.sy);
      ctx.closePath(); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ pitch

  function drawPitch(ctx, cam) {
    var hw = C.PITCH_HALF_WIDTH;
    var y0 = C.STRIKER_Y - 3.2, y1 = C.BOWLER_Y + 3.2;
    var a = cam.project(-hw, y0, 0), b = cam.project(hw, y0, 0);
    var c = cam.project(hw, y1, 0), d = cam.project(-hw, y1, 0);
    if (a.visible && b.visible && c.visible && d.visible) {
      var g = ctx.createLinearGradient(0, Math.min(c.sy, d.sy), 0, Math.max(a.sy, b.sy));
      g.addColorStop(0, P.pitchWorn);
      g.addColorStop(1, P.pitch);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy);
      ctx.closePath(); ctx.fill();

      // Worn patches where the bowlers land.
      ctx.fillStyle = 'rgba(150,126,88,0.45)';
      [C.STRIKER_Y + 5.2, C.BOWLER_Y - 5.2].forEach(function (wy) {
        var w1 = cam.project(-0.9, wy - 1.2, 0), w2 = cam.project(0.9, wy - 1.2, 0);
        var w3 = cam.project(0.9, wy + 1.2, 0), w4 = cam.project(-0.9, wy + 1.2, 0);
        if (!w1.visible || !w3.visible) return;
        ctx.beginPath();
        ctx.moveTo(w1.sx, w1.sy); ctx.lineTo(w2.sx, w2.sy);
        ctx.lineTo(w3.sx, w3.sy); ctx.lineTo(w4.sx, w4.sy);
        ctx.closePath(); ctx.fill();
      });
    }
    creases(ctx, cam, C.STRIKER_Y, 1);
    creases(ctx, cam, C.BOWLER_Y, -1);
  }

  function creases(ctx, cam, stumpY, dir) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    var hw = C.PITCH_HALF_WIDTH;
    function line(x1, y1, x2, y2) {
      var a = cam.project(x1, y1, 0.01), b = cam.project(x2, y2, 0.01);
      if (!a.visible || !b.visible) return;
      ctx.lineWidth = Math.max(1, 0.06 * a.s);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
    }
    var pop = stumpY + C.CREASE_FRONT * dir;
    line(-1.32, pop, 1.32, pop);                  // popping crease
    line(-1.32, stumpY, 1.32, stumpY);            // bowling crease
    line(-1.32, stumpY, -1.32, pop);              // return creases
    line(1.32, stumpY, 1.32, pop);
  }

  function drawStumps(ctx, cam, y, broken) {
    var xs = [-C.STUMP_HALF_WIDTH, 0, C.STUMP_HALF_WIDTH];
    for (var i = 0; i < 3; i++) {
      var b = cam.project(xs[i], y, 0);
      var t = cam.project(xs[i], y, C.STUMP_HEIGHT);
      if (!b.visible || !t.visible) continue;
      var lean = broken ? (i - 1) * 18 : 0;
      ctx.strokeStyle = '#efe6d2';
      ctx.lineWidth = Math.max(1.2, 0.05 * b.s);
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(t.sx + lean, t.sy + (broken ? 6 : 0));
      ctx.stroke();
    }
    // Bails.
    if (!broken) {
      var l = cam.project(-C.STUMP_HALF_WIDTH, y, C.STUMP_HEIGHT + 0.02);
      var r = cam.project(C.STUMP_HALF_WIDTH, y, C.STUMP_HEIGHT + 0.02);
      if (l.visible && r.visible) {
        ctx.strokeStyle = '#efe6d2';
        ctx.lineWidth = Math.max(1, 0.035 * l.s);
        ctx.beginPath(); ctx.moveTo(l.sx, l.sy); ctx.lineTo(r.sx, r.sy); ctx.stroke();
      }
    }
  }

  // ------------------------------------------------------------------- ball

  function drawBall(ctx, cam, x, y, z, opts) {
    var p = cam.project(x, y, z);
    if (!p.visible) return null;
    var shadow = cam.project(x, y, 0);
    if (shadow.visible && z > 0.03) {
      ctx.fillStyle = 'rgba(12,32,16,' + CG.clamp(0.3 - z * 0.03, 0.05, 0.3) + ')';
      ctx.beginPath();
      ctx.ellipse(shadow.sx, shadow.sy, Math.max(1.5, 0.09 * shadow.s), Math.max(0.8, 0.04 * shadow.s), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    var r = Math.max(4.0, 0.036 * p.s * 4.5);
    ctx.fillStyle = (opts && opts.colour) || P.ball;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.ballSeam;
    ctx.lineWidth = Math.max(0.8, r * 0.22);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r * 0.72, -0.6, 0.9);
    ctx.stroke();
    return p;
  }

  /* Whole background for a down-the-pitch camera. */
  function drawGroundScene(ctx, w, h, cam, opts) {
    opts = opts || {};
    drawSky(ctx, w, h, cam, opts.dusk !== false);
    drawTurf(ctx, w, h, cam);
    drawTrees(ctx, cam);
    OVAL.lights.forEach(function (l) { drawLightTower(ctx, cam, l[0], l[1]); });
    drawPavilion(ctx, cam);
    drawOutbuildings(ctx, cam);
    drawScoreboard(ctx, cam, opts.scoreboard);
    drawNets(ctx, cam);
    OVAL.goals.forEach(function (gy) { drawGoalPosts(ctx, cam, gy); });
    drawFence(ctx, cam);
    drawBoundaryRope(ctx, cam);
    drawPitch(ctx, cam);
  }

  // --------------------------------------------------------------- top-down

  function drawTopDownGround(ctx, w, h, td) {
    ctx.fillStyle = '#2f6b37';
    ctx.fillRect(0, 0, w, h);

    // Football oval.
    ctx.save();
    ctx.translate(td.cx, td.cy);
    ctx.scale(1, 1);
    ctx.fillStyle = P.grass;
    ctx.beginPath();
    ctx.ellipse(0, 0, OVAL.fenceRX * td.mpp, OVAL.fenceRY * td.mpp, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Junior boundary.
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.ellipse(0, 0, C.BOUNDARY_RX * td.mpp, C.BOUNDARY_RY * td.mpp, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // 30-metre-ish inner ring, for reading the field.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 * td.mpp, 24 * td.mpp, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Pitch.
    var a = td.project(-C.PITCH_HALF_WIDTH, C.BOWLER_Y + 1.5);
    var b = td.project(C.PITCH_HALF_WIDTH, C.STRIKER_Y - 1.5);
    ctx.fillStyle = P.pitch;
    ctx.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);

    // Landmarks, so the top-down view is still obviously Findex Oval.
    ctx.fillStyle = 'rgba(203,195,180,0.9)';
    var pv = td.project(OVAL.pavilion.x, OVAL.pavilion.y);
    ctx.fillRect(pv.sx - 5, pv.sy - OVAL.pavilion.w * td.mpp / 2, 10, OVAL.pavilion.w * td.mpp);
    var sb = td.project(OVAL.scoreboard.x, OVAL.scoreboard.y);
    ctx.fillStyle = '#20262f';
    ctx.fillRect(sb.sx - 4, sb.sy - 9, 8, 18);
    var ic = td.project(OVAL.indoor.x, OVAL.indoor.y);
    ctx.fillStyle = 'rgba(223,227,226,0.9)';
    ctx.fillRect(ic.sx - OVAL.indoor.w * td.mpp / 2, ic.sy - OVAL.indoor.d * td.mpp / 2,
      OVAL.indoor.w * td.mpp, OVAL.indoor.d * td.mpp);
    var tk = td.project(OVAL.tank.x, OVAL.tank.y);
    ctx.beginPath(); ctx.arc(tk.sx, tk.sy, Math.max(3, OVAL.tank.w * td.mpp / 2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,210,0.85)';
    OVAL.lights.forEach(function (l) {
      var p = td.project(l[0], l[1]);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2); ctx.fill();
    });
  }

  CG.scene = {
    OVAL: OVAL,
    drawGroundScene: drawGroundScene,
    drawPitch: drawPitch,
    drawStumps: drawStumps,
    drawBall: drawBall,
    drawTopDownGround: drawTopDownGround,
    strokeGroundEllipse: strokeGroundEllipse
  };

})(window.CG = window.CG || {});
