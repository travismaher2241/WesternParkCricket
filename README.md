# Liam's Boundary Bash

A front-on arcade batting game for Liam and the Western Park Warriors. Watch the bowler, follow the ball, and press left or right as it reaches the near crease.

## Play

Open `index.html` directly in a browser, or run:

```sh
node tools/serve.js 5174
```

Then visit http://localhost:5174.

- **Left arrow / A:** hit left.
- **Right arrow / D:** hit right.
- **Touch:** tap the matching shot button.
- **Escape:** pause or resume. Switching tabs pauses automatically.
- **Sound button:** toggle sound effects.

The challenge is 12 balls with three wickets. Good timing scores runs; sweet timing scores six. A wrong-side shot or a badly mistimed swing costs a wicket. Backyard, Club and All-star increase delivery speed and tighten timing windows. Practice continues without an innings limit and marks the contact crease in gold. Personal bests are saved locally, separately for each difficulty; practice does not affect records.

## Design

Original procedural canvas artwork, fixed front-on camera, automatic shot choice and footwork, visible ball bounce, simple timing feedback, boundary celebrations and synthesised sound. No external assets, dependencies or build step are required to play. The venue and character are stylised Western Park/Liam representations; precise likeness, kit and ground layout still need the user's references.

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

## Earlier simulation

The previous batting-and-bowling prototype is preserved at `simulation.html`. Its documentation is in `SIMULATION-README.md`; its original simulation modules are unchanged. It is separate from the new arcade game.
