/* Match rules and scoring.

   Two overs an innings, two wickets. Liam bats first and sets a score, then
   bowls to defend it. Wides and no-balls cost a run and are re-bowled. */
(function (CG) {
  'use strict';

  var C = CG.C;

  function Match(opts) {
    this.diff = opts.diff;
    this.seed = opts.seed;
    this.overs = opts.overs || C.OVERS;
    this.wickets = opts.wickets || C.WICKETS;
    this.innings = 0;
    this.completed = [];
    this.log = [];
    this.target = null;
  }

  Match.prototype.startInnings = function (battingTeam, bowlingTeam, batterNames) {
    this.innings += 1;
    this.battingTeam = battingTeam;
    this.bowlingTeam = bowlingTeam;
    this.runs = 0;
    this.wicketsDown = 0;
    this.legalBalls = 0;
    this.extras = 0;
    this.overRuns = 0;
    this.batters = batterNames.map(function (n) {
      return { name: n, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: null };
    });
    this.strikerIdx = 0;
    this.log = [];
    return this;
  };

  Match.prototype.striker = function () { return this.batters[this.strikerIdx]; };

  Match.prototype.ballsLeft = function () {
    return this.overs * C.BALLS_PER_OVER - this.legalBalls;
  };

  Match.prototype.overText = function () {
    var o = Math.floor(this.legalBalls / C.BALLS_PER_OVER);
    var b = this.legalBalls % C.BALLS_PER_OVER;
    return o + '.' + b;
  };

  Match.prototype.needed = function () {
    if (this.target == null) return null;
    return Math.max(0, this.target - this.runs);
  };

  Match.prototype.requiredRate = function () {
    var need = this.needed();
    if (need == null) return null;
    var left = this.ballsLeft();
    if (left <= 0) return Infinity;
    return need / left * 6;
  };

  /* Apply one delivery's outcome.

     shot may be null when the ball was illegal before the batter played it.
     Returns a ball record, also pushed onto the log. */
  Match.prototype.applyBall = function (delivery, shot, fieldRes) {
    var rec = {
      over: this.overText(),
      delivery: delivery,
      shot: shot,
      field: fieldRes,
      runs: 0,
      extras: 0,
      legal: true,
      wicket: null,
      text: ''
    };

    var striker = this.striker();

    if (delivery.illegal) {
      rec.legal = false;
      rec.extras = delivery.illegal.runs;
      this.runs += rec.extras;
      this.extras += rec.extras;
      this.overRuns += rec.extras;
      rec.text = delivery.illegal.label;
      this.log.push(rec);
      return rec;
    }

    this.legalBalls += 1;
    striker.balls += 1;

    // Bat never made contact.
    if (!shot || shot.contact === 'miss') {
      if (shot && shot.out) {
        rec.wicket = shot.out;
        rec.text = shot.out.label + ' - ' + shot.out.detail;
        this.fallOfWicket(shot.out);
        this.log.push(rec);
        return rec;
      }
      var byes = (shot && (shot.bye || shot.legBye)) || 0;
      if (byes) {
        rec.extras = byes;
        this.runs += byes;
        this.extras += byes;
        this.overRuns += byes;
        rec.text = (shot.legBye ? 'Leg bye' : 'Bye') + ' - ' + byes + ' run';
      } else {
        rec.text = (shot && shot.note) || 'Dot ball';
      }
      this.log.push(rec);
      return rec;
    }

    // Caught, run out, boundary or ran runs.
    if (fieldRes && fieldRes.out) {
      rec.runs = fieldRes.runs || 0;
      this.runs += rec.runs;
      this.overRuns += rec.runs;
      striker.runs += rec.runs;
      rec.wicket = fieldRes.out;
      rec.text = fieldRes.label;
      this.fallOfWicket(fieldRes.out);
      this.log.push(rec);
      return rec;
    }

    var runs = fieldRes ? fieldRes.runs : 0;
    rec.runs = runs;
    this.runs += runs;
    this.overRuns += runs;
    striker.runs += runs;
    if (runs === 4) striker.fours += 1;
    if (runs === 6) striker.sixes += 1;
    rec.text = fieldRes ? fieldRes.label : 'No run';

    // Odd runs rotate the strike, but with a two-batter innings the hero
    // keeps the strike so the player is never locked out of the game.
    this.log.push(rec);
    return rec;
  };

  Match.prototype.fallOfWicket = function (out) {
    var striker = this.striker();
    striker.out = true;
    striker.howOut = out.label;
    this.wicketsDown += 1;
    var next = this.strikerIdx + 1;
    if (next < this.batters.length) this.strikerIdx = next;
  };

  Match.prototype.inningsOver = function () {
    if (this.wicketsDown >= this.wickets) return true;
    if (this.legalBalls >= this.overs * C.BALLS_PER_OVER) return true;
    if (this.target != null && this.runs >= this.target) return true;
    return false;
  };

  Match.prototype.endInnings = function () {
    var summary = {
      team: this.battingTeam,
      runs: this.runs,
      wickets: this.wicketsDown,
      balls: this.legalBalls,
      extras: this.extras,
      batters: this.batters.slice(),
      log: this.log.slice()
    };
    this.completed.push(summary);
    if (this.completed.length === 1) this.target = this.runs + 1;
    return summary;
  };

  Match.prototype.result = function () {
    if (this.completed.length < 2) return null;
    var a = this.completed[0], b = this.completed[1];
    if (b.runs > a.runs) {
      return {
        winner: b.team, loser: a.team,
        margin: (this.wickets - b.wickets) + ' wicket' + ((this.wickets - b.wickets) === 1 ? '' : 's'),
        text: b.team.shortName + ' won by ' + (this.wickets - b.wickets) + ' wicket' + ((this.wickets - b.wickets) === 1 ? '' : 's')
      };
    }
    if (b.runs === a.runs) {
      return { winner: null, loser: null, margin: 'tie', text: 'Tied at Findex Oval' };
    }
    var by = a.runs - b.runs;
    return {
      winner: a.team, loser: b.team,
      margin: by + ' run' + (by === 1 ? '' : 's'),
      text: a.team.shortName + ' won by ' + by + ' run' + (by === 1 ? '' : 's')
    };
  };

  /* Best moments, for the results screen. */
  Match.prototype.highlights = function (log) {
    var out = [];
    (log || this.log).forEach(function (r) {
      if (r.wicket) out.push({ kind: 'wicket', over: r.over, text: r.text });
      else if (r.runs === 6) out.push({ kind: 'six', over: r.over, text: 'Six ' + shotWord(r) });
      else if (r.runs === 4) out.push({ kind: 'four', over: r.over, text: 'Four ' + shotWord(r) });
      else if (r.shot && r.shot.contact === 'middle') out.push({ kind: 'shot', over: r.over, text: 'Middled the ' + r.shot.shotName.toLowerCase() });
    });
    return out.slice(0, 6);
  };

  function shotWord(r) {
    if (!r.shot) return '';
    return 'off the ' + r.shot.shotName.toLowerCase();
  }

  CG.Match = Match;

})(window.CG = window.CG || {});
