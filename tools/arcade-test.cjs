const assert=require('node:assert/strict');
const rules=require('../src/arcade-rules.js');
for(const difficulty of Object.keys(rules.levels)){
 for(const side of [-1,1]){
  assert.equal(rules.judge(0,side,side,difficulty).runs,6);
  assert.equal(rules.judge(-.4*rules.levels[difficulty].window,side,side,difficulty).runs,4);
  assert.equal(rules.judge(0,-side,side,difficulty).wicket,false);
  assert.equal(rules.miss(side*.09,'Miss').wicket,true);
  assert.equal(rules.miss(side,'Miss').wicket,false);
  assert.equal(rules.judge(-2*rules.levels[difficulty].window,side,side*.09,difficulty).wicket,true);
  assert.equal(rules.judge(1.2*rules.levels[difficulty].window,side,side,difficulty).runs,0);
 }
}
assert.equal(rules.complete({balls:12,wickets:0,practice:false}),true);
assert.equal(rules.complete({balls:3,wickets:3,practice:false}),true);
assert.equal(rules.complete({balls:30,wickets:9,practice:true}),false);
console.log('Arcade timing, directions and innings rules passed.');

const delivery=require('../src/delivery.js');
for(const duration of [.92,1.12,1.38])for(const fraction of [.56,.60,.78,.82]){
 const bounce=duration*fraction, epsilon=1e-7;
 const before=delivery.sample(bounce-epsilon,duration,fraction);
 const after=delivery.sample(bounce+epsilon,duration,fraction);
 assert.ok(before.height<.00001 && after.height<.00001,'continuous ground contact');
 assert.ok(before.verticalVelocity<0 && after.verticalVelocity>0,'one bounce reverses vertical velocity');
 assert.ok(Math.abs(after.verticalVelocity/-before.verticalVelocity-delivery.RESTITUTION)<.00001);
 assert.ok(Math.abs(before.progress-after.progress)<.00001);
 assert.equal(delivery.sample(duration,duration,fraction).progress,1);
 assert.ok(delivery.sample(duration,duration,fraction).height>0,'ball reaches bat before another bounce');
 assert.equal(rules.judge(.10,1,1,'easy').missed,true,'late ball cannot score');
}
console.log('Ballistic delivery continuity, restitution, contact and late cutoff passed.');
