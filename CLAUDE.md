# Working on this repo

## Shipping work

**Always merge finished work into `main` and push `main`.** Do not stop at a
feature branch, and do not ask first — this is standing permission. The
sequence at the end of every piece of work:

```
git checkout <feature-branch> && git commit ...
git fetch origin main
git merge origin/main          # resolve conflicts, then verify the result runs
git checkout main && git merge <feature-branch>
git push -u origin main
```

Pull requests are not wanted unless explicitly asked for.

`main` moves under you: other sessions work on this game in parallel, so
always `git fetch origin main` and merge it before pushing. If both sides
changed the same code, prefer the newer work rather than stitching the two
together, verify the merged game actually runs, and say in the merge message
what was dropped.

## Checking the game before pushing

The game is canvas art, so a change is not verified until it has been looked
at. `node tools/serve.js 5174`, then drive it with Playwright (Chromium is at
`/opt/pw-browsers/chromium`) and read the screenshots — at phone width
(430x930) as well as desktop, because the two lay out differently.

## The ground

Western Park Oval, Warragul. The layout follows the user's aerial
photographs: clubrooms, shelter and water tank on the western side, the
indoor centre beyond the north-eastern fence, a gum line and the estate's
roofs along the north, white post fence around the ring. Both views look
north from the southern end. See `docs/DECISIONS.md` for what is still
estimated.
