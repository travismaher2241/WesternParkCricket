const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(()=>{let cb;window.requestAnimationFrame=f=>cb=f;window.paint=()=>cb(0);});
await page.goto('http://localhost:5174');await page.locator('#play').click();
for(const [name,t,line] of [['release',0,1],['bounce',.8,1],['drive-contact',1,1],['pull-contact',1,-1]]){
 await page.evaluate(({t,line})=>{const d=BoundaryBashDebug,s=d.state();Object.assign(s,{phase:'delivery',time:1.38*t,flight:1.38,bounce:line<0?.58:.8,line,pending:null,swinging:false});if(t===1)d.shot(line);document.querySelector('#feedback').classList.remove('show');window.paint();},{t,line});
 await page.screenshot({path:`artifacts/delivery-${name}.png`});
}
await browser.close();})();
