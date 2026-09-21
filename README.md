# Liam's Boundary Bash

A front-on arcade batting game for Liam and the Western Park Warriors. Watch the bowler, follow the ball, and press left, straight or right as it reaches the bat.

## Play

Open `index.html` directly in a browser, or run:

```sh
node tools/serve.js 5174
```

Then visit http://localhost:5174.

- **Left arrow / A:** hit to the leg side.
- **Right arrow / D:** hit to the off side.
- **Up arrow / W:** straight drive.
- **Touch:** tap the matching shot button.
- **Escape:** pause or resume. Switching tabs pauses automatically.
- **Sound button:** toggle sound effects.

The challenge is 12 balls with three wickets. Good timing scores runs; sweet timing scores six. Missing a straight delivery can bowl you; a missed ball outside the stumps is a dot ball. Backyard, Club and All-star increase delivery speed and tighten timing windows. Practice continues without an innings limit and marks the contact plane in gold. Personal bests are saved locally, separately for each difficulty; practice does not affect records.

## Design

Original illustrated right-handed batting sprites over a procedural canvas ground, fixed front-on camera, automatic shot choice and footwork, visible ball bounce, simple timing feedback, boundary celebrations and synthesised sound. The sprite atlas is bundled locally; no external services, dependencies or build step are required to play. The venue and character are stylised Western Park/Liam representations; precise likeness, kit and ground layout still need the user's references.

The batsman uses eight authored poses in `assets/liam-batting-right.png`: stance, backlift, and distinct contact/follow-through pairs. Images are never mirrored. The right-handed stance and helmet stay consistent for both shot directions. Input, timing and scoring remain separate from the artwork.

The atlas's own leg-side pair is not used. Frame 4 turns his head round to square leg before the ball is hit, and frame 5 is a front-foot drive finish. The leg-side pull is built at load time instead, in `buildLegSide()` in `src/arcade.js`: frame 4's opened-up body and bat (the hips and shoulders do open on a pull) wearing frame 6's head, which is still watching the ball, then the same body with the bat wrapped up round the left shoulder for the follow-through. It only draws between canvases, so it works when `index.html` is opened directly. Two authored leg-side frames would be better, and would replace this with no other code changes.

`src/arcade-rules.js` contains the pure timing and innings rules. `src/arcade.js` contains input, match state, animation, artwork and local score storage. `arcade.css` handles desktop and mobile layouts.

## Checks

```sh
node tools/arcade-test.cjs
```

The browser check needs Playwright available through Node module resolution (or `NODE_PATH`) and the server above running:

```sh
node tools/arcade-browser-test.cjs
```

It checks a complete innings using keyboard and touch events, score progression, pause, all-out, practice and persistence, and saves screenshots in `artifacts/`.

The sprite review captures every authored pose in the game camera and checks the left/leg-side and right/off-side mapping:

```sh
node tools/arcade-sprite-check.cjs
```

The older `arcade-swing-check.cjs` and `arcade-swing-capture.cjs` are retained as development history; their mathematical bat rig is no longer the rendered character.

## Earlier simulation

The previous batting-and-bowling prototype is preserved at `simulation.html`. Its documentation is in `SIMULATION-README.md`; its original simulation modules are unchanged. It is separate from the new arcade game.

## Delivery and input

The bowler uses `assets/bowler-action.png`, an eight-pose original atlas with run-up, gather, delivery stride, overhead release and follow-through. `src/delivery.js` uses constant gravity, a continuous bounce with vertical restitution 0.62 and a modest horizontal speed loss. Difficulty slows the whole delivery uniformly. Short leg-side balls and fuller off-side balls reach suitable pull/drive heights.

Input contacts the ball immediately at its displayed position; it has no hidden swing delay. The ideal contact plane is in front of the batter's crease. A press more than 45 ms beyond that plane misses, so a ball behind the batter cannot earn four or six. This remains an arcade scoring model, not a full cricket simulator.

`node tools/delivery-preview.cjs` captures release, bounce and both contacts for visual review.
