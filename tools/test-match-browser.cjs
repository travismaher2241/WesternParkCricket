const assert=require('node:assert/strict');
const {launch}=require('./browser.cjs');
(async()=>{const browser=await launch();try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Date.now=()=>42;let queue=[],now=0;window.requestAnimationFrame=fn=>queue.push(fn);window.stepFrames=n=>{for(let i=0;i<n;i++){now+=1000/120;const q=queue;queue=[];q.forEach(fn=>fn(now));}};});
 await page.goto('http://localhost:5174');
 const step=n=>page.evaluate(n=>stepFrames(n),n);
 await step(1);await page.screenshot({path:'artifacts/test-menu-desktop.png'});
 await page.locator('#testPlay').click();await step(330);
 assert.match(await page.locator('#strikerName').innerText(),/Liam/);
 // Real keyboard input scores beyond the old 12-ball cap.
 for(let n=0;n<14;n++){
  await page.evaluate(()=>{const s=BoundaryBashDebug.state();Object.assign(s,{phase:'delivery',time:s.flight,line:1,pending:null});});
  await page.keyboard.press('ArrowRight');await step(260);
 }
 let state=await page.evaluate(()=>BoundaryBashDebug.state().test);
 assert.equal(state.innings[0].balls,14);assert.equal(state.innings[0].runs,84);assert.equal(state.status,'batting');
 assert.equal(state.innings[0].batters[0].runs,48);assert.equal(state.innings[0].batters[1].runs,36);
 await page.locator('#scorecardButton').click();assert.equal(await page.locator('#testPanel').isVisible(),true);
 await page.screenshot({path:'artifacts/test-scorecard-desktop.png'});
 const before=JSON.stringify(state);await step(500);assert.equal(JSON.stringify(await page.evaluate(()=>BoundaryBashDebug.state().test)),before);
 await page.locator('#testExit').click();await page.reload();await step(1);
 await page.locator('#testResume').click();assert.equal(JSON.stringify(await page.evaluate(()=>BoundaryBashDebug.state().test)),before);
 await step(330);
 // Four actual missed straight deliveries no longer trigger arcade's 3-wicket ending.
 for(let n=0;n<4;n++){
  await page.evaluate(()=>{const s=BoundaryBashDebug.state();Object.assign(s,{phase:'delivery',line:.09,time:s.flight+.17,pending:null});});await step(220);
 }
 state=await page.evaluate(()=>BoundaryBashDebug.state().test);assert.equal(state.innings[0].wickets,4);assert.equal(state.status,'batting');
 await page.locator('#scorecardButton').click();await page.locator('#testDeclare').click();
 assert.equal((await page.evaluate(()=>BoundaryBashDebug.state().test)).status,'batting');
 await page.locator('#testDeclare').click();assert.equal((await page.evaluate(()=>BoundaryBashDebug.state().test)).status,'interval');
 await page.locator('#testContinue').click();state=await page.evaluate(()=>BoundaryBashDebug.state().test);
 assert.equal(state.innings.length,2);assert.equal(state.innings[1].team,'England');assert.equal(state.innings[1].wickets,10);
 await page.screenshot({path:'artifacts/test-england-simulated.png'});
 await page.locator('#testContinue').click();state=await page.evaluate(()=>BoundaryBashDebug.state().test);assert.equal(state.innings.length,3);assert.equal(state.innings[2].team,'Australia');
 // Bat a large second innings and then simulate the fourth to a final result.
 await page.evaluate(()=>{const d=BoundaryBashDebug,s=d.state();s.flight=1.38;s.bounce=.8;s.line=1;for(let n=0;n<200;n++){s.time=s.flight;d.resolve({runs:6,wicket:false,title:'SIX!',detail:'Test'});}d.showTestPanel();});
 await page.locator('#testDeclare').click();await page.locator('#testDeclare').click();await page.locator('#testContinue').click();
 state=await page.evaluate(()=>BoundaryBashDebug.state().test);assert.equal(state.status,'complete');assert.equal(state.result.winner,'Australia');
 await page.screenshot({path:'artifacts/test-match-result.png'});
 // Mobile menu, bowling first, first simulated innings and batting scorecard.
 await page.locator('#testExit').click();await page.setViewportSize({width:430,height:930});await step(1);
 await page.screenshot({path:'artifacts/test-menu-phone.png'});
 await page.locator('#testOrder').selectOption('England');await page.locator('#testPlay').click();
 assert.match(await page.locator('#testTitle').innerText(),/ENGLAND TO BAT/);
 await page.locator('#testContinue').click();await page.locator('#testContinue').click();await step(330);
 await page.screenshot({path:'artifacts/test-batting-phone.png'});
 await page.locator('#scorecardButton').click();await page.screenshot({path:'artifacts/test-scorecard-phone.png'});
 assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
 await page.locator('#testContinue').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#testPanel').isVisible(),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#testPanel').isVisible(),false);
 await page.setViewportSize({width:844,height:390});await step(1);
 await page.locator('#scorecardButton').click();await page.screenshot({path:'artifacts/test-scorecard-landscape.png'});
 await page.locator('#testContinue').click();
 // Storage failure must be visible and must not crash a live match.
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Storage blocked');};});
 await page.locator('#scorecardButton').click();assert.match(await page.locator('#saveNotice').innerText(),/Saving is unavailable/);
 assert.deepEqual(errors,[]);
 console.log('Test UI passed: unlimited innings, team scoring, 4 wickets, pause, save/resume, declarations, simulated opposition, full match, phone controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
