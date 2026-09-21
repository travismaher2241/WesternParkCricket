# Cricket reference and presentation review

Reviewed 20 September 2026 after feedback on the batter facing the camera.

## References

- Cricket Australia, Cricket For All coaching tips: balanced side-on batting stance, slightly bent knees and feet roughly shoulder-width apart. https://resources.playcommunity.pulselive.com/playcommunity/document/2023/08/21/cfeb4aee-1799-4002-b65a-a8df116e5a85/SOA-Cricket-For-All-Program_Interactive.pdf
- MCC Law 7: the popping crease is in front of and parallel to the bowling crease, with return creases perpendicular. https://www.lords.org/mcc/the-laws/the-creases
- MCC Law 2.9: the bowler's-end umpire must not obstruct the run-up or striker's view. https://www.lords.org/mcc/the-laws/the-umpires

## Applied to this camera

The camera looks from behind the striker towards the bowler. Liam's right-handed stance therefore shows his side/back, with the helmet looking up the pitch. His front foot is further up the pitch, knees flexed, both hands on the bat, and pad fronts pointing towards the off side rather than at the camera. The back foot remains grounded during the shot. The previous symmetrical front-facing character is no longer used for batting.

The bowler's-end umpire stands behind the far wicket, separate from the run-up. A second umpire is at square leg, aligned with the striker's popping crease. A non-striker is beside the far crease. The wicketkeeper is beyond the near edge of this camera view. The boundary surrounds the pitch instead of crossing between the wickets.

A missed ball outside the wicket is a dot; only the straight deliveries can bowl the batter. The ball rebounds once before contact and continues towards the wicket if missed. The bowler lowers the bowling arm into a follow-through after release.

## Intentional arcade simplifications

This remains a three-direction batting challenge, not a full cricket simulation. Timing sets scoring outcomes, running is automatic, Liam stays on strike, there are three wickets, and real-world metre measurements are compressed for visibility. Character likeness and the exact Findex Oval layout still need photo references. Gameplay checks are not evidence of coaching-grade biomechanics.


## Sprite replacement on 21 September 2026

Reviewed the original Stick Cricket screenshot published by Stick Sports in its developer blog: https://medium.com/stick-sports/developers-blog-stick-cricket-df6926f84e05 . Reference only; its artwork is not bundled into this game.

Replaced the mirrored procedural figure with an original illustrated eight-pose right-handed sprite atlas. In the behind-striker view, left controls the leg side and right controls the off side, matching the classic screenshot controls. No pose uses horizontal mirroring or a rotated profile helmet. Assets are stored locally with transparent backgrounds. The character is stylised, not a photographic likeness of Liam.

## Bowling and bounce revision

References: ECB bowling action guidance (run-up, gather, front-foot plant, release and follow-through): https://ashes.ecb.co.uk/news/118671/the-need-for-speed . University of Sydney cricket bounce experiments: https://physics.usyd.edu.au/~cross/cricket.html . The game uses gravity and restitution with deliberately slower presentation for arcade play; it does not claim measured pitch-specific realism.

Bowler asset: `assets/bowler-action.png`, generated with the built-in image generation tool. Final generation prompt:

> Create a game sprite atlas, 1536x1024 transparent background, 4 columns x 2 rows each cell 384x512. Eight full-body poses of SAME anatomically normal male right-arm cricket fast bowler, orange short-sleeve jersey, cream trousers, dark shoes, short brown hair, no hat. Attractive clean illustrated sports game art with dark outlines and simple shaded volumes, classic arcade cricket. Camera from batsman's end looking straight toward bowler, front three-quarter view. Each character same scale feet baseline local y470, centered x192, fits within cell, no labels no grid no scenery no shadows. Ordered left-to-right: row1 two alternating running strides approaching camera; gather with both hands near chest and left knee raised; delivery bound landing on right back foot with left arm pointing up toward target. Row2 first front left foot planted, straight RIGHT bowling arm vertically overhead just releasing ball (right hand on viewer LEFT at local x145 y40), left arm tucked into ribs; second bowling right arm sweeps down across torso, torso bending forward over planted left leg; third follow-through right leg comes past left and arm finishes across body; fourth relaxed recovery walking forward. Real cricket overarm bowling not baseball throwing, consistent identity and scale, all limbs clear. No ball in release/followthrough cells; tiny red ball in right hand for running/gather cells. Actual transparent alpha background.
