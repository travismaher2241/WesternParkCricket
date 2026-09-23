const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5174');
await page.getByRole('button',{name:"LET'S BAT"}).click();
assert.ok(await page.evaluate(()=>BoundaryBashDebug.battingReady()));
for(const [name,phase,swinging,side,time,swing,frame] of [
 ['ready','ready',false,1,0,0,0],['backlift','delivery',false,1,.9,0,1],
 ['off-contact','result',true,1,0,.17,2],['off-follow','result',true,1,0,.5,3],
 // Dedicated pull poses keep the ready stance's foot order and eyeline.
 ['leg-contact','result',true,-1,0,.17,8],['leg-follow','result',true,-1,0,.5,9],
 ['straight-contact','result',true,0,0,.17,6],['straight-follow','result',true,0,0,.5,7]]){
 await page.evaluate(v=>{const s=BoundaryBashDebug.state();Object.assign(s,v,{paused:true,flight:1.38,result:{runs:0,wicket:false,missed:true},pending:null,ballFlight:null});document.querySelector('#feedback').classList.remove('show');},{phase,swinging,side,time,swing});
 await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>BoundaryBashDebug.battingFrame()),frame);
 await page.screenshot({path:`artifacts/batsman-${name}.png`,clip:{x:510,y:425,width:260,height:280}});
}
assert.equal(await page.evaluate(()=>BoundaryBashDebug.pickStroke(-1)==='pull'||BoundaryBashDebug.pickStroke(-1)==='flick'),true);
assert.equal(await page.evaluate(()=>BoundaryBashDebug.pickStroke(1)==='cut'||BoundaryBashDebug.pickStroke(1)==='coverDrive'),true);
assert.deepEqual(errors,[]);const leg=await page.evaluate(()=>{const L=BoundaryBashDebug.legFrames();return !!(L.legContact&&L.legFollow&&L.legContact.width===384&&L.legFollow.height===512);});
assert.equal(leg,true,'leg-side frames were not built');
console.log('All sprite poses loaded and captured, including the built leg-side pull; right-handed shot mapping passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

