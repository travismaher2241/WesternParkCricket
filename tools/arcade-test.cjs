const assert=require('node:assert/strict');
const rules=require('../src/arcade-rules.js');
for(const difficulty of Object.keys(rules.levels)){
 for(const side of [-1,1]){
  assert.equal(rules.judge(0,side,side,difficulty).runs,6);
  assert.equal(rules.judge(.4*rules.levels[difficulty].window,side,side,difficulty).runs,4);
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
