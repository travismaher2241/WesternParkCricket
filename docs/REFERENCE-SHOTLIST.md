# Reference photographs needed from Trav

Taken from the build plan. Phone photos are fine. **Avoid portrait mode,
heavy zoom and filters** — they distort proportions, which is exactly what
the sprite sheets need to be right.

Until these arrive, every person and every landmark in the game is a
placeholder. The list below says what each photo unblocks and which file it
replaces, so nothing has to be guessed twice.

---

## Liam

| Shot | Notes |
| --- | --- |
| Full body — front, back, left, right | Neutral stance, arms slightly away from the body |
| Batting stance with helmet on | From behind and from square |

Even daylight, camera at about waist height, the whole body in frame including
the feet. These set the master turnaround and the body proportions that every
animation frame is built from.

**Unblocks:** the character sheet, and the fixed body height and ground-contact
line the sprite rules depend on.
**Currently a placeholder in:** `src/render/view.js` (`drawPlayer`, `POSES`).

## Playing shirt and kit

| Shot | Notes |
| --- | --- |
| Shirt flat, front and back | Lay it flat, shoot square-on, fill the frame |
| Close-up of the club crest | Straight on |
| Close-up of every sponsor | One per photo |
| Cap and helmet | Front and side |
| Trousers | Full length |

Include a ruler or a known object if the panel scale is unclear.

**Unblocks:** the uniform sheet — shirt panels, logos, sponsors, cap details.
**Currently a placeholder in:** `CG.TEAM` in `src/core/config.js` (flat club
blue and white only, no crest, no sponsors).

> Do not let anyone infer a sponsor or a panel from an old photo. The public
> imagery varies and does not prove Liam's present junior kit.

## Equipment

Bat front and back, helmet, pads, gloves, shoes. Photograph colours and brand
marks square-on.

**Unblocks:** bat, pad, glove and helmet colours, currently generic in
`drawPlayer`.

## Findex Oval — the pitch

| Shot | Notes |
| --- | --- |
| From each batting crease, looking directly down the pitch | Stand on the centre line, hold the phone level |
| The pitch strip itself | Grass colour, worn areas |
| The junior boundary | Where the cones or rope actually sit |

**Unblocks:** both down-the-pitch gameplay backgrounds, and the real pitch
orientation relative to the ground's landmarks.

## Findex Oval — panorama

Eight overlapping landscape photos from the centre of the pitch, turning a
full circle. Keep exposure and zoom unchanged between shots.

**Unblocks:** the ball-follow view and the landmark map.

## Findex Oval — landmarks

One straight-on view and one context view of each:

- Scoreboard — shape, colours, support structure
- Clubrooms / pavilion as seen from the old oval
- Light towers
- Practice nets
- Boundary fence style, gates, advertising boards, spectator areas
- Football infrastructure — goal posts, markings
- Prominent trees, roads, houses, hills on the skyline

**Unblocks:** the landmark board.
**Currently placeholders in:** the `OVAL` object at the top of
`src/render/scene.js` — fence radii, goal post positions, light towers,
pavilion, scoreboard and nets are all invented and sit at guessed coordinates.

## A normal match

A wide shot from behind Liam batting, and one from behind him bowling. These
show the junior boundary, the real field positions and the spectators, and
they are the check on whether the game's field placings look like his actual
games.

**Currently a placeholder in:** `CG.FIELD` in `src/core/config.js`.

---

## Approval gates

In order. Nothing downstream should be produced until the gate above it is
signed off.

1. **Liam's likeness and base proportions** — before any animation frame.
2. **The exact uniform reference sheet** — before generating any player.
3. **The Findex Oval landmark board and pitch orientation** — before painting
   any gameplay background.
4. **One finished batting frame and one finished ground view**, approved as
   the master style references.
5. Only then: full sprite sheets and camera backgrounds.

## Sprite rules to hold to

- Fix one exact body height in pixels and one ground-contact line.
- Fix batting handedness and bowling arm before generating any pose.
- Transparent backgrounds, same canvas size for every frame.
- Lock helmet, shirt panels, logos, gloves, pads, shoes and bat colours in a
  master sheet first.
- Key poses first; in-betweens interpolated or hand-corrected afterwards.
- Keep the bat face and the ball separate where possible, so collision and
  timing stay tunable independently of the art.
- Never rely on generated text for club logos or sponsors. Place approved
  vector or cleaned raster artwork afterwards.
