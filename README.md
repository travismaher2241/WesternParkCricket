# Liam at Findex Oval

A playable vertical slice of the cricket game described in
`Liam_Western_Park_Cricket_Game_Build_Plan.docx`: two overs an innings at
Findex Oval, Liam bats to set a score and then bowls to defend it, with AI
fielding. Landscape web game, keyboard and touch.

This is the build plan's **first playable version**, not the finished game.
Everything visual is grey-box and waiting on the reference photographs listed
in [docs/REFERENCE-SHOTLIST.md](docs/REFERENCE-SHOTLIST.md).

---

## Run it

```bash
node tools/serve.js
```

Then open <http://localhost:5173>. A server is needed only because browsers
block local file access for multi-file pages; there is no build step and no
dependencies.

Headless balance testing, which needs no browser:

```bash
node tools/simtest.js 3000
```

## Controls

**Batting** — the shot key *is* the swing. Press it as the ball reaches you.

| Key | Action |
| --- | --- |
| `↑` / `↓` | front foot / back foot — set this *before* the ball arrives |
| `←` / `→` | aim within the arc of the stroke you choose |
| `J` | Defend |
| `K` | Drive |
| `L` | Cut / Pull — it becomes a cut or a pull depending on where the ball actually is |
| `I` | Loft |

**Bowling**

| Key | Action |
| --- | --- |
| `1`–`6` | stock ball, outswinger, inswinger, yorker, bouncer, slower ball |
| arrows | move the landing marker on the pitch |
| `Space` | three times: run in, stop the pace bar, stop the release marker in the middle |

`Esc` pauses, `M` mutes. Every control also has an on-screen button for touch.

---

## How it is put together

The build plan's central implementation principle is that cricket simulation
stays separate from visuals — *"a delivery should exist as data before
animation"*. That is the architecture here, not a comment.

```
src/core/config.js      constants, palette, shot and delivery tables, field placings
src/core/rng.js         seeded RNG, so a session can be replayed while tuning

src/sim/trajectory.js   ball flight: integrates a state into a sampled path
src/sim/delivery.js     plan (type, line, length) + execution (pace, release) -> a ball
src/sim/bat.js          scores footwork, shot, line, height and timing -> contact -> launch
src/sim/field.js        who reaches the ball first, catches, boundaries, runs, run-outs
src/sim/match.js        rules and scoring: overs, wickets, extras, target, result

src/render/view.js      pinhole camera, top-down map, skeleton figure drawing
src/render/scene.js     Findex Oval — landmark map and both down-the-pitch views
src/audio.js            synthesised bat crack, pad, stumps, applause, magpies
src/main.js             phase machine, input, HUD

tools/serve.js          static server for local play
tools/simtest.js        headless harness: aiming accuracy, carry, outcome mix, 400 matches
```

Nothing in `src/sim/` touches the DOM, the canvas or `Math.random`. That is
what lets `tools/simtest.js` play thousands of matches in a second, and it
means changing a sprite can never quietly change a cricket outcome.

Each ball is recorded the way the plan asks: bowler and delivery type,
intended line and length, release accuracy, actual trajectory, batter
footwork, shot, timing error, contact category, launch speed and angle,
fielder interaction, and the runs or wicket. Practice mode puts that record
on screen after every ball.

## Current balance

From `node tools/simtest.js 3000`, AI against AI on Normal:

| Measure | Value |
| --- | --- |
| Delivery aiming error | under 0.10 m at every length |
| Run rate | ~5.8 per over |
| Wicket | roughly every 9 balls |
| Wides | ~4% of deliveries |
| Innings score | median 9, upper quartile 14, top end high 20s |

A middled drive reaches the rope; a middled loft can just clear it. Those two
facts are what `POWER_MPS` in `src/sim/bat.js` is tuned against, so re-check
them if the boundary size in `config.js` changes.

## What is deliberately not here yet

Per the build plan's deferred list: other grounds and WDCA clubs, a character
creator, full match formats, a spin bowling system, manual fielding, career
progression, historical kits, recorded commentary. Spin, in particular, is not
modelled — `src/sim/delivery.js` handles swing and seam only.

The ball-follow camera is currently a top-down map rather than a layered
360-degree pan. It reads clearly and it is honest about where every fielder
is, but it is a substitute for the camera the plan specifies, and the landmark
sheet in `src/render/scene.js` is already laid out so the pan can be built
against the same coordinates.

## Next

1. Trav supplies the photographs in [docs/REFERENCE-SHOTLIST.md](docs/REFERENCE-SHOTLIST.md).
2. Confirm the open questions in [docs/DECISIONS.md](docs/DECISIONS.md) — most
   are one line in `src/core/config.js`.
3. Approve the reference boards, then replace the grey-box figures and the
   Findex Oval geometry in place.
