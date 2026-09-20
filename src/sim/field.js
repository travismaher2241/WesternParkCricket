/* Fielding.

   Fielders are simulated, not driven. Each one has a start position, a
   reaction delay, a running speed, a reach and a throwing arm. Given a ball
   that has already left the bat, this works out who gets to it first, whether
   it carried, and how many runs that is worth. */
(function (CG) {
  'use strict';

  var C = CG.C;

  function positions(handed) {
    var mirror = (handed === 'left') ? -1 : 1;
    return CG.FIELD.map(function (f) {
      return {
        id: f.id, name: f.name, keeper: !!f.keeper, bowler: !!f.bowler,
        x: f.dx * mirror, y: C.STRIKER_Y + f.dy
      };
    });
  }

  function dist2d(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Resolve everything that happens after the ball leaves the bat. */
  function resolve(post, ctx) {
    var rng = ctx.rng, diff = ctx.diff;
    var fielders = positions(ctx.handed);
    var s = post.samples;
    var step = 2;

    var boundaryIdx = post.boundaryIndex;
    var result = {
      fielders: fielders,
      chase: null,
      outcome: null,
      runs: 0,
      out: null,
      interceptT: null,
      label: '',
      ballEndT: post.duration
    };

    // Who touches the ball first, and when.
    var bestIdx = -1, bestFielder = null, bestArrive = 0;
    var limit = (boundaryIdx >= 0) ? boundaryIdx : s.length - 1;

    for (var i = 0; i <= limit; i += step) {
      var b = s[i];
      for (var f = 0; f < fielders.length; f++) {
        var fd = fielders[f];
        var d = dist2d(fd.x, fd.y, b.x, b.y);
        var reach = C.FIELDER_REACH + (fd.keeper ? 0.4 : 0);
        if (d > reach) {
          var need = C.FIELDER_REACTION + (d - reach) / C.FIELDER_SPEED;
          if (need > b.t) continue;
        }
        if (b.z > C.CATCH_REACH_Z) continue;         // sailing over their head
        bestIdx = i; bestFielder = fd;
        bestArrive = Math.max(b.t, C.FIELDER_REACTION + Math.max(0, d - reach) / C.FIELDER_SPEED);
        break;
      }
      if (bestIdx >= 0) break;
    }

    // Nobody got near it before the rope.
    if (bestIdx < 0 && boundaryIdx >= 0) {
      var bb = s[boundaryIdx];
      var six = (bb.bounces === 0 && bb.z > 0.5);
      result.outcome = six ? 'six' : 'four';
      result.runs = six ? 6 : 4;
      result.label = six ? 'SIX! Over the rope at Findex Oval' : 'FOUR - beats the field to the boundary';
      result.ballEndT = bb.t;
      result.chase = nearestChase(fielders, bb, post);
      return result;
    }

    // Ball pulled up inside the rope with nobody in range: nearest jogs over.
    if (bestIdx < 0) {
      var rest = s[post.restIndex];
      var near = nearest(fielders, rest.x, rest.y);
      var arrive = C.FIELDER_REACTION + dist2d(near.x, near.y, rest.x, rest.y) / C.FIELDER_SPEED;
      bestFielder = near;
      bestIdx = post.restIndex;
      bestArrive = Math.max(rest.t, arrive);
    }

    var hit = s[bestIdx];
    result.interceptT = bestArrive;
    result.chase = {
      id: bestFielder.id, name: bestFielder.name,
      fromX: bestFielder.x, fromY: bestFielder.y,
      toX: hit.x, toY: hit.y,
      startT: Math.min(C.FIELDER_REACTION, bestArrive),
      arriveT: bestArrive
    };
    result.ballEndT = Math.max(hit.t, bestArrive);

    // A catch only counts if the ball has not touched the ground.
    var airborne = (hit.bounces === 0 && hit.z > 0.06);
    if (airborne) {
      var spare = bestArrive - (C.FIELDER_REACTION + dist2d(bestFielder.x, bestFielder.y, hit.x, hit.y) / C.FIELDER_SPEED);
      var comfort = CG.clamp(0.55 + spare * 0.9, 0.25, 1);
      var heightPenalty = (hit.z > 2.1 || hit.z < 0.25) ? 0.82 : 1;
      var pace = Math.sqrt(hit.vx * hit.vx + hit.vy * hit.vy + hit.vz * hit.vz);
      var pacePenalty = CG.clamp(1 - Math.max(0, pace - 18) / 40, 0.55, 1);
      var p = diff.catch * comfort * heightPenalty * pacePenalty;

      if (rng.next() < p) {
        result.outcome = 'caught';
        result.out = {
          mode: bestFielder.keeper ? 'caught behind' : 'caught',
          label: bestFielder.keeper ? 'Caught behind' : ('Caught at ' + bestFielder.name.toLowerCase()),
          by: bestFielder.name
        };
        result.label = result.out.label;
        return result;
      }
      result.dropped = true;
      result.label = 'Dropped at ' + bestFielder.name.toLowerCase() + '!';
      bestArrive += 0.75;
      result.interceptT = bestArrive;
      result.ballEndT = bestArrive;
    }

    // Runs. Time the batters have is time to the pickup, plus the throw back.
    var end = nearerEnd(hit.x, hit.y);
    var throwT = dist2d(bestFielder.x, bestFielder.y, end.x, end.y) / C.THROW_SPEED;
    var available = bestArrive + C.PICKUP_TIME + throwT;

    var raw = (available - 0.30) / C.RUN_TIME;
    var runs = Math.min(3, Math.floor(raw));
    var frac = raw - Math.floor(raw);

    if (runs < 0) runs = 0;

    // Greedy extra run when the throw is only just going to beat them. Only
    // batters who are already running take the gamble, so a dot ball can
    // never turn into a run-out out of nowhere.
    if (runs >= 1 && runs < 3 && frac > 0.82) {
      var margin = (1 - frac);
      var outChance = CG.clamp(0.10 + margin * 1.5, 0.08, 0.40);
      if (rng.next() < outChance) {
        result.outcome = 'runout';
        result.runs = runs;
        result.out = { mode: 'run out', label: 'RUN OUT - ' + bestFielder.name + ' hits the stumps', by: bestFielder.name };
        result.label = result.out.label;
        return result;
      }
      runs += 1;
    }

    result.outcome = runs > 0 ? 'ran' : 'stopped';
    result.runs = runs;
    if (!result.label) {
      result.label = runs === 0
        ? 'Straight to ' + bestFielder.name.toLowerCase()
        : runs + (runs === 1 ? ' run' : ' runs') + ', fielded at ' + bestFielder.name.toLowerCase();
    } else if (runs > 0) {
      result.label += ' ' + runs + (runs === 1 ? ' run' : ' runs');
    }
    return result;
  }

  function nearest(fielders, x, y) {
    var best = fielders[0], bd = Infinity;
    for (var i = 0; i < fielders.length; i++) {
      var d = dist2d(fielders[i].x, fielders[i].y, x, y);
      if (d < bd) { bd = d; best = fielders[i]; }
    }
    return best;
  }

  function nearestChase(fielders, b, post) {
    var near = nearest(fielders, b.x, b.y);
    return {
      id: near.id, name: near.name,
      fromX: near.x, fromY: near.y,
      toX: b.x * 0.92, toY: b.y * 0.92,
      startT: C.FIELDER_REACTION, arriveT: b.t + 0.8
    };
  }

  function nearerEnd(x, y) {
    var a = { x: 0, y: C.STRIKER_Y }, b = { x: 0, y: C.BOWLER_Y };
    return dist2d(x, y, a.x, a.y) <= dist2d(x, y, b.x, b.y) ? a : b;
  }

  CG.field = { resolve: resolve, positions: positions };

})(window.CG = window.CG || {});
