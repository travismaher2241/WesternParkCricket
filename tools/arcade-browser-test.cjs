const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 Math.random=()=>.5;
 let queue=[],now=0;window.requestAnimationFrame=fn=>{queue.push(fn);return queue.length;};
 window.stepFrames=(n)=>{for(let i=0;i<n;i++){now+=1000/120;const pending=queue;queue=[];pending.forEach(fn=>fn(now));}};
});
await page.goto('http://localhost:5174');
const step=n=>page.evaluate(n=>window.stepFrames(n),n);
await step(1);
await page.getByRole('button',{name:"LET'S BAT"}).click();
await step(201);
await page.getByRole('button',{name:'Pause game',exact:true}).click();
await step(1000);
assert.equal(await page.locator('#score').innerText(),'0/0');
await page.getByRole('button',{name:'BACK TO THE CREASE'}).click();
const bag=[-1,-1,-1,1,1,1];for(let i=5;i>0;i--){const j=Math.floor(.5*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
// Run-up starts after the ready banner disappears. Each six returns to run-up.
for(let i=0;i<12;i++){
 await step(i===0?125:127);
 // Swing before arrival so the blade reaches the ball at the crease.
 await page.evaluate(()=>{const d=window.BoundaryBashDebug,s=d.state();s.time=s.flight-d.SWING.contact;});
 const side=bag[5-i%6];
 if(i%2===0)await page.keyboard.press(side<0?'ArrowLeft':'ArrowRight');
 else await page.locator(side<0?'#left':'#right').dispatchEvent('pointerdown',{pointerType:'touch'});
 const contact=await page.evaluate(()=>{const s=window.BoundaryBashDebug.state();return {at:s.contactAt,flight:s.flight,runs:s.pending.runs};});
 assert.ok(Math.abs(contact.at-contact.flight)<1e-9);
 assert.equal(contact.runs,6);
 // The shot resolves when the bat reaches the ball, a beat after the press,
 // so step through the downswing before reading the result.
 await step(20);
 assert.equal(await page.locator('#feedback b').innerText(),'SIX!',`delivery ${i+1}`);
 assert.equal(await page.locator('#score').innerText(),`${(i+1)*6}/0`);
 if(i===0){
  await step(1);await page.waitForTimeout(150);
  await page.screenshot({path:'artifacts/arcade-six.png'});
  await step(25);await page.screenshot({path:'artifacts/arcade-follow-through.png'});
  await step(233);
 }else if(i===1){
  await step(1);await page.screenshot({path:'artifacts/arcade-left-contact.png'});await step(258);
 }else await step(259);
}
assert.equal(await page.locator('#results').isVisible(),true);
assert.equal(await page.locator('#finalScore').innerText(),'72/0');
await page.screenshot({path:'artifacts/arcade-results.png'});
await page.reload();await step(1);
assert.equal(await page.locator('#target').innerText(),'72');
await page.getByRole('button',{name:"LET'S BAT"}).click();
await step(6000);
assert.equal(await page.locator('#results').isVisible(),true);
assert.equal(await page.locator('#finalScore').innerText(),'0/3');
await page.getByRole('button',{name:'Back to menu',exact:true}).click();
await page.getByRole('button',{name:'Get your eye in'}).click();
await step(3000);
assert.equal(await page.locator('#results').isVisible(),false);
assert.match(await page.locator('#overs').innerText(),/PRACTICE/);
await page.keyboard.press('Escape');
assert.equal(await page.locator('#pause').isVisible(),true);
await page.getByRole('button',{name:'Back to menu',exact:true}).click();
await page.setViewportSize({width:844,height:390});await step(1);
await page.screenshot({path:'artifacts/arcade-landscape-menu.png'});
await page.getByRole('button',{name:"LET'S BAT"}).click();await step(350);
await page.screenshot({path:'artifacts/arcade-landscape-game.png'});
// An early but playable swing resolves at blade contact, before the ball
// passes the crease. Waiting until arrival is no longer perfect timing.
const timing=await page.evaluate(()=>{
 const d=window.BoundaryBashDebug,s=d.state();
 s.phase='delivery';s.pending=null;s.line=1;s.time=s.flight;
 d.shot(1);
 const delayedRuns=s.pending.runs;
 s.pending=null;s.time=s.flight-d.SWING.contact-.08;
 d.shot(1);
 window.stepFrames(18);
 const before=s.phase;
 window.stepFrames(2);
 return {delayedRuns,before,after:s.phase,groundY:s.hitOrigin.groundY,crease:d.geometry().near};
});
assert.ok(timing.delayedRuns<6,'waiting until arrival should not be perfect');
assert.equal(timing.before,'delivery');
assert.equal(timing.after,'result','resolve at blade contact without waiting past the crease');
assert.ok(timing.groundY<timing.crease,'early contact stays in front of the crease');
assert.deepEqual(errors,[]);
console.log('Browser checks passed: 12-ball innings, keyboard and touch shots, pause, 3-wicket ending, replay, practice, saved record, landscape layout. No JavaScript errors.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
