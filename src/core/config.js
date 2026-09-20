/* Liam Western Park Cricket - constants, palette and tuning tables.
   Everything here is data. No rendering, no DOM, no randomness. */
(function (CG) {
  'use strict';

  var PITCH_LENGTH = 20.12;
  var STRIKER_Y = -PITCH_LENGTH / 2;   // striker's stumps
  var BOWLER_Y  =  PITCH_LENGTH / 2;   // bowler's stumps

  // +x is the OFF side for a right-handed batter, +y is up the pitch toward
  // the bowler, +z is up. Cameras and sprites mirror x for a left hander.
  CG.C = {
    PITCH_LENGTH: PITCH_LENGTH,
    STRIKER_Y: STRIKER_Y,
    BOWLER_Y: BOWLER_Y,
    PITCH_HALF_WIDTH: 1.52,
    CREASE_FRONT: 1.22,           // popping crease, 1.22m in front of the stumps
    RELEASE_Y: BOWLER_Y - 1.35,
    RELEASE_Z: 1.92,
    STUMP_HALF_WIDTH: 0.1143,
    STUMP_HEIGHT: 0.711,

    // Findex Oval is a football oval, so it is long and comparatively narrow.
    // Junior boundary, metres from the centre of the pitch.
    BOUNDARY_RX: 41,
    BOUNDARY_RY: 47,

    GRAVITY: 9.81,
    DRAG: 0.0052,
    BOUNCE_Z: 0.54,               // vertical restitution off the strip
    BOUNCE_PACE: 0.78,            // horizontal pace retained off the pitch
    ROLL_FRICTION: 0.58,          // per-second decay once the ball is rolling

    FIELDER_SPEED: 4.9,
    FIELDER_REACTION: 0.45,
    FIELDER_REACH: 1.05,
    CATCH_REACH_Z: 2.55,
    PICKUP_TIME: 0.42,
    THROW_SPEED: 23,
    RUN_TIME: 2.70,               // seconds for one completed junior run

    OVERS: 2,
    WICKETS: 2,
    BALLS_PER_OVER: 6
  };

  CG.PALETTE = {
    clubBlue:   '#1b4f9c',
    clubBlueDk: '#123667',
    clubBlueLt: '#4d86d6',
    white:      '#f4f6fa',
    paleGrey:   '#d7dce4',
    midGrey:    '#8a93a3',
    ink:        '#16202e',
    grass:      '#4e9a52',
    grassDk:    '#3b7d41',
    grassLt:    '#66ad63',
    pitch:      '#cdb98a',
    pitchWorn:  '#bda476',
    sky:        '#8fc4e8',
    skyDusk:    '#c9d9e6',
    ball:       '#b32626',
    ballSeam:   '#f0ece2',
    opponent:   '#d9531e',
    opponentDk: '#8f3310',
    warning:    '#e0b02a',
    good:       '#3fa564',
    bad:        '#d0453a'
  };

  // ---------------------------------------------------------------------
  // Shots. `az` is the base azimuth in degrees: 0 is straight back down the
  // ground, positive rotates toward the off side. `arc` is how far the aim
  // input can swing that azimuth. `len` is the ideal bounce distance from
  // the striker's stumps, in metres.
  // ---------------------------------------------------------------------
  CG.SHOTS = {
    defend: {
      id: 'defend', name: 'Defend', key: 'J', label: 'J',
      power: 0.30, elev: 5, az: 12, arc: 30,
      len: [0.6, 7.5], lenTol: 3.0,
      height: [0.05, 1.30], reachX: [-0.55, 1.05],
      foot: 'any', risk: 0.10, aerial: 0.02
    },
    drive: {
      id: 'drive', name: 'Drive', key: 'K', label: 'K',
      power: 0.94, elev: 10, az: 18, arc: 58,
      len: [0.0, 5.2], lenTol: 2.2,
      height: [0.05, 1.45], reachX: [-0.75, 1.25],
      foot: 'front', risk: 0.28, aerial: 0.16
    },
    cross: {
      id: 'cross', name: 'Cut / Pull', key: 'L', label: 'L',
      power: 0.97, elev: 13, az: 0, arc: 40,
      len: [5.4, 13.0], lenTol: 2.4,
      height: [0.45, 1.95], reachX: [-1.15, 1.55],
      foot: 'back', risk: 0.34, aerial: 0.22
    },
    loft: {
      id: 'loft', name: 'Loft', key: 'I', label: 'I',
      power: 0.90, elev: 30, az: 8, arc: 62,
      len: [0.0, 6.8], lenTol: 3.2,
      height: [0.05, 1.70], reachX: [-0.85, 1.35],
      foot: 'front', risk: 0.55, aerial: 0.72
    }
  };
  CG.SHOT_ORDER = ['defend', 'drive', 'cross', 'loft'];

  // ---------------------------------------------------------------------
  // Deliveries. `missRadius` is how far a poor release drags the ball from
  // the planned landing point; `swing` is lateral acceleration in flight.
  // ---------------------------------------------------------------------
  CG.DELIVERIES = {
    stock: {
      id: 'stock', name: 'Stock ball', key: '1',
      benefit: 'Best control, smallest miss radius', cost: 'Least movement',
      speed: [20.5, 22.5], swing: 0.4, seam: 0.35, missRadius: 0.85,
      lengthBias: 0, lineBias: 0, paceMeter: 1.0
    },
    outswing: {
      id: 'outswing', name: 'Outswinger', key: '2',
      benefit: 'Threatens the outside edge', cost: 'Harder to start on line',
      speed: [20.0, 22.0], swing: 3.4, seam: 0.5, missRadius: 1.25,
      lengthBias: -0.3, lineBias: -0.35, paceMeter: 1.0
    },
    inswing: {
      id: 'inswing', name: 'Inswinger', key: '3',
      benefit: 'Attacks the pads and the stumps', cost: 'Can drift down leg',
      speed: [20.0, 22.0], swing: -3.4, seam: 0.5, missRadius: 1.25,
      lengthBias: -0.3, lineBias: 0.35, paceMeter: 1.0
    },
    yorker: {
      id: 'yorker', name: 'Yorker', key: '4',
      benefit: 'High wicket potential', cost: 'A miss becomes a full toss',
      speed: [21.5, 23.5], swing: 0.8, seam: 0.3, missRadius: 1.95,
      lengthBias: -2.6, lineBias: 0, paceMeter: 1.05
    },
    bouncer: {
      id: 'bouncer', name: 'Bouncer', key: '5',
      benefit: 'Forces the batter onto the back foot', cost: 'A miss is a wide or a gift',
      speed: [22.0, 24.0], swing: 0.5, seam: 0.4, missRadius: 1.75,
      lengthBias: 3.4, lineBias: 0, bounceBoost: 0.16, paceMeter: 1.1
    },
    slower: {
      id: 'slower', name: 'Slower ball', key: '6',
      benefit: 'Disrupts the batter timing', cost: 'Weak if it is predictable',
      speed: [15.5, 17.5], swing: 1.0, seam: 0.4, missRadius: 1.2,
      lengthBias: -0.4, lineBias: 0, paceMeter: 0.8
    }
  };
  CG.DELIVERY_ORDER = ['stock', 'outswing', 'inswing', 'yorker', 'bouncer', 'slower'];

  // Length name, keyed by bounce distance from the striker's stumps.
  CG.lengthName = function (d, bounced) {
    if (!bounced) return 'full toss';
    if (d < 1.1) return 'yorker';
    if (d < 3.0) return 'full';
    if (d < 6.2) return 'good length';
    if (d < 8.4) return 'back of a length';
    return 'short';
  };

  CG.lineName = function (x, handed) {
    var s = (handed === 'left') ? -x : x;
    if (s < -0.55) return 'down leg';
    if (s < -0.12) return 'on the pads';
    if (s < 0.14) return 'at the stumps';
    if (s < 0.55) return 'just outside off';
    return 'wide of off';
  };

  // ---------------------------------------------------------------------
  // Fielding positions, as offsets from the striker's stumps for a
  // right-handed batter. Mirrored in x for a left hander.
  // ---------------------------------------------------------------------
  CG.FIELD = [
    { id: 'keeper',    name: 'Keeper',      dx:   0.0, dy:  -3.4, keeper: true },
    { id: 'slip',      name: 'Slip',        dx:   2.4, dy:  -2.8 },
    { id: 'point',     name: 'Point',       dx:  18.5, dy:   2.5 },
    { id: 'cover',     name: 'Cover',       dx:  17.0, dy:  12.5 },
    { id: 'midoff',    name: 'Mid-off',     dx:  10.0, dy:  23.0 },
    { id: 'midon',     name: 'Mid-on',      dx: -10.5, dy:  23.0 },
    { id: 'midwicket', name: 'Midwicket',   dx: -17.5, dy:  11.0 },
    { id: 'squareleg', name: 'Square leg',  dx: -18.5, dy:   1.5 },
    { id: 'fineleg',   name: 'Fine leg',    dx:  -9.0, dy: -21.0 },
    { id: 'thirdman',  name: 'Third man',   dx:  11.0, dy: -22.0 },
    { id: 'bowler',    name: 'Bowler',      dx:   1.2, dy:  17.5, bowler: true }
  ];

  CG.DIFFICULTY = {
    easy:   { id: 'easy',   name: 'Easy',   window: 0.158, speedMul: 0.86, aiTiming: 0.088, aiChoice: 0.34, catch: 0.76, missRadiusMul: 0.75 },
    normal: { id: 'normal', name: 'Normal', window: 0.118, speedMul: 1.00, aiTiming: 0.062, aiChoice: 0.22, catch: 0.85, missRadiusMul: 1.00 },
    hard:   { id: 'hard',   name: 'Hard',   window: 0.088, speedMul: 1.09, aiTiming: 0.044, aiChoice: 0.13, catch: 0.93, missRadiusMul: 1.20 }
  };

  CG.CONTACT = [
    { id: 'middle', name: 'Middled',      min: 0.86 },
    { id: 'good',   name: 'Good contact', min: 0.65 },
    { id: 'mishit', name: 'Mishit',       min: 0.43 },
    { id: 'edge',   name: 'Edge',         min: 0.24 },
    { id: 'miss',   name: 'Missed',       min: -1 }
  ];

  CG.TEAM = {
    home: {
      name: 'Western Park Warriors',
      shortName: 'Western Park',
      primary: CG.PALETTE.clubBlue,
      secondary: CG.PALETTE.white,
      trim: CG.PALETTE.clubBlueLt
    },
    away: {
      name: 'Drouin Creek Colts',
      shortName: 'Drouin Creek',
      primary: CG.PALETTE.opponent,
      secondary: CG.PALETTE.white,
      trim: CG.PALETTE.opponentDk
    }
  };

  // Placeholder identity until Trav supplies photographs. See docs/.
  CG.HERO = {
    name: 'Liam',
    bats: 'right',
    bowls: 'right',
    partner: 'Ollie'
  };

  CG.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  CG.lerp = function (a, b, t) { return a + (b - a) * t; };
  CG.DEG = Math.PI / 180;

})(window.CG = window.CG || {});
