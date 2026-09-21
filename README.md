# Liam's Boundary Bash

A front-on arcade batting game for Liam and the Western Park Warriors. Watch the bowler, follow the ball, and press left or right as it reaches the near crease.

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

The challenge is 12 balls with three wickets. Good timing scores runs; sweet timing scores six. Missing a straight delivery can bowl you; a missed ball outside the stumps is a dot ball. Backyard, Club and All-star increase delivery speed and tighten timing windows. Practice continues without an innings limit and marks the contact crease in gold. Personal bests are saved locally, separately for each difficulty; practice does not affect records.

## Design

Original illustrated right-handed batting sprites over a procedural canvas ground, fixed front-on camera, automatic shot choice and footwork, visible ball bounce, simple timing feedback, boundary celebrations and synthesised sound. The sprite atlas is bundled locally; no external services, dependencies or build step are required to play. The venue and character are stylised Western Park/Liam representations; precise likeness, kit and ground layout still need the user's references.

The batsman uses eight authored poses in `assets/liam-batting-right.png`: stance, backlift, and distinct contact/follow-through pairs. Images are never mirrored. The right-handed stance and helmet stay consistent for both shot directions. Input, timing and scoring remain separate from the artwork.

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
