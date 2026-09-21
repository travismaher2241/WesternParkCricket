# Open decisions

The build plan lists decisions still to be made. This slice takes the plan's
recommended default for each one so there was something to play. Each row says
where to change it — most are a single line.

| Decision | Plan's default | What this build does | Change it in |
| --- | --- | --- | --- |
| Liam bats right or left handed | Match Liam exactly | Right, switchable on the menu | `CG.HERO.bats`, `src/core/config.js` — the whole render and sim path mirrors on `handed`, so left-handed works today |
| Liam bowls pace or spin | His real style, other discipline later | Pace only | `CG.DELIVERIES`, `src/core/config.js`. **Spin is not modelled** — `src/sim/delivery.js` does swing and seam, not turn off the pitch |
| Target platform | Landscape web/mobile first | Landscape web, keyboard and touch | — |
| Visual technique | 2D sprites over layered backgrounds | Grey-box figures over drawn geometry, same camera system | `src/render/` |
| Opening match length | Two overs per innings | Two overs, two wickets | `C.OVERS` / `C.WICKETS`, `src/core/config.js` |
| Opponent | Fictional local side | "Drouin Creek Colts", invented, orange | `CG.TEAM.away`, `src/core/config.js` |
| Game title | Leave open | Placeholder: "Liam at Findex Oval" | `index.html` title and menu heading |

## Things the game assumes that nobody has confirmed

These are guesses made to get a playable build, and each one is a question
worth asking rather than a decision that has been taken.

- **Ground dimensions.** The junior boundary is 41 m square and 47 m straight,
  inside a football oval of 58 m by 74 m. Invented. `C.BOUNDARY_RX` /
  `C.BOUNDARY_RY` and `OVAL` in `src/render/scene.js`.
- **Landmark positions.** The aerial photographs of Western Park Reserve now
  set the layout: clubrooms and water tank on the western side, the indoor
  centre beyond the north-eastern fence, a gum line and the estate's roofs
  along the north, trees heaviest east and south, and a white post fence
  right around the ring. Both views are drawn from the southern end looking
  north. Still estimated: the distances between those landmarks, the
  scoreboard's exact position (a structure is visible on the northern side,
  but not identifiable), and whether the practice nets are where `OVAL.nets`
  puts them. `ground()` in `src/arcade.js` and `OVAL` in
  `src/render/scene.js`.
- **Junior bowling pace.** 74–86 km/h for a stock ball, 56–63 for a slower
  ball. `CG.DELIVERIES`, `src/core/config.js`.
- **Evening light.** The club says juniors play Monday, Wednesday and Friday
  evenings, so both views are lit for dusk. `drawSky` in
  `src/render/scene.js`; pass `dusk: false` for a daytime look.
- **Liam's partner is called Ollie**, and the away batters Jack and Nate.
  Names only. `CG.HERO.partner` and `startMatch` in `src/main.js`.
- **Field placings.** A standard junior ring. `CG.FIELD`,
  `src/core/config.js`. The "normal match" photographs will show what his
  team actually sets.
- **Strike rotation.** Odd runs do not change the strike, so the hero keeps
  the bat and the player is never locked out of a twelve-ball innings. This
  is a deliberate arcade choice, not an oversight — see `Match.applyBall` in
  `src/sim/match.js`.

## Research rules being followed

From the plan, and worth keeping in the repo:

- Official club and council material for facts. Social posts and user
  photographs are visual reference only.
- Never infer a current sponsor, uniform detail or ground feature from an old
  photo without confirmation.
- Findex Oval is the home ground. The newer Club Hotel Oval is not modelled.
