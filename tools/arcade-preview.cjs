const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:5174');
 await page.screenshot({path:'artifacts/arcade-menu.png'});
 await page.getByRole('button',{name:"LET'S BAT"}).click();
 await page.waitForTimeout(2600);
 await page.screenshot({path:'artifacts/arcade-game.png'});
 await page.getByRole('button',{name:'Pause game',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Back to menu',exact:true}).click();
 await page.screenshot({path:'artifacts/arcade-phone-menu.png'});
 await page.getByRole('button',{name:"LET'S BAT"}).click();
 await page.waitForTimeout(2800);
 await page.screenshot({path:'artifacts/arcade-phone-game.png'});
 console.log(JSON.stringify({errors,bodyWidth:await page.evaluate(()=>document.body.scrollWidth)}));
 await browser.close();
})();

