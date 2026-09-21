/* One ballistic delivery, slowed uniformly for arcade readability. */
(function(root) {
  const GRAVITY = 9.81, RELEASE_HEIGHT = 2.1, RESTITUTION = .62;
  function sample(time, duration, bounceFraction) {
    const physicalDuration = .82;
    const t = Math.max(0,time / duration) * physicalDuration;
    const bounceTime = bounceFraction * physicalDuration;
    const initialVelocity = (.5*GRAVITY*bounceTime*bounceTime-RELEASE_HEIGHT)/bounceTime;
    const impactVelocity = initialVelocity-GRAVITY*bounceTime;
    const after = t-bounceTime;
    const height = after < 0
      ? RELEASE_HEIGHT+initialVelocity*t-.5*GRAVITY*t*t
      : -impactVelocity*RESTITUTION*after-.5*GRAVITY*after*after;
    // Modest horizontal speed loss at impact, continuous position.
    const distance = Math.min(t,bounceTime)+Math.max(0,after)*.88;
    const contactDistance = bounceTime+(physicalDuration-bounceTime)*.88;
    return {progress:distance/contactDistance,height:Math.max(0,height),
      verticalVelocity:after<0?initialVelocity-GRAVITY*t:-impactVelocity*RESTITUTION-GRAVITY*after};
  }
  const api={sample,GRAVITY,RESTITUTION};
  if(typeof module!=='undefined')module.exports=api;else root.CricketDelivery=api;
})(typeof window!=='undefined'?window:globalThis);
