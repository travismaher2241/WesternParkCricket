const assert=require('node:assert/strict');
const T=require('../src/test-match.js');
const innings=m=>T.current(m);
function allOut(m){for(let n=0;n<10&&!innings(m).closed;n++)T.ball(m,0,true);}
function runs(m,n){while(n>=6&&!innings(m).closed){T.ball(m,6);n-=6;}while(n--&&!innings(m).closed)T.ball(m,1);}
let m=T.create('Australia',42);
T.ball(m,1);assert.equal(innings(m).striker,1);assert.equal(innings(m).batters[0].runs,1);
for(let n=0;n<4;n++)T.ball(m,0);
T.ball(m,1);assert.equal(innings(m).striker,1,'single on sixth ball switches twice');
T.ball(m,0,true);assert.equal(innings(m).striker,2);assert.equal(innings(m).batters[1].out,true);
assert.equal(innings(m).wickets,1);
m=T.create();for(let n=0;n<12000;n++)T.ball(m,0);
assert.equal(m.status,'batting');assert.equal(innings(m).balls,12000);assert.equal(innings(m).history.length,6);
assert.equal(innings(m).batters.reduce((n,b)=>n+b.balls,0),12000);
// Australia bat first, defend 101 and win by 100 runs.
m=T.create();runs(m,100);allOut(m);T.advance(m);runs(m,100);allOut(m);T.advance(m);runs(m,100);T.declare(m);T.advance(m);
assert.equal(innings(m).target,101);allOut(m);assert.equal(m.result.text,'Australia win by 100 runs');
const length=m.innings.length;T.advance(m);T.ball(m,6);assert.equal(m.innings.length,length);assert.equal(innings(m).runs,0);
// Australia bowl first, chase with all ten wickets intact; stop immediately.
m=T.create('England');runs(m,20);allOut(m);T.advance(m);runs(m,20);T.declare(m);T.advance(m);runs(m,10);allOut(m);T.advance(m);
assert.equal(innings(m).target,11);runs(m,12);assert.equal(m.result.text,'Australia win by 10 wickets');assert.equal(innings(m).balls,2);
// Both directions of innings defeat; no spurious fourth innings.
for(const first of ['Australia','England']){
 m=T.create(first);runs(m,10);allOut(m);T.advance(m);runs(m,50);allOut(m);T.advance(m);runs(m,20);allOut(m);
 assert.equal(m.result.winner,first==='Australia'?'England':'Australia');assert.match(m.result.text,/an innings and 20 runs/);assert.equal(m.innings.length,3);
}
// Equal aggregate with the last side all out is a tie, not a win.
m=T.create();runs(m,10);allOut(m);T.advance(m);runs(m,10);allOut(m);T.advance(m);runs(m,10);allOut(m);T.advance(m);runs(m,10);allOut(m);
assert.equal(m.result.text,'MATCH TIED');
// Deterministic simulation, reconciliation, target stopping and save roundtrip.
for(let seed=1;seed<=100;seed++){
 const a=T.create('England',seed),b=T.create('England',seed);T.simulate(a);T.simulate(b);
 assert.deepEqual(a,b);assert.equal(innings(a).wickets,10);
 assert.equal(innings(a).runs,innings(a).batters.reduce((n,p)=>n+p.runs,0));
 assert.equal(innings(a).balls,innings(a).batters.reduce((n,p)=>n+p.balls,0));
 assert.deepEqual(T.restore(JSON.stringify(a)),a);
}
assert.equal(T.restore('bad json'),null);assert.equal(T.restore('{}'),null);
console.log('Test match checks passed: unlimited balls, strike, wickets, declarations, chase, innings wins, tie, simulation, saves.');
