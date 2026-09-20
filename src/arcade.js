/* Boundary Bash: original canvas artwork and a front-on, two-button arcade loop. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
  const rules = window.ArcadeRules, audio = window.CG.audio;
  let width = 1200, height = 760, last = 0, difficulty = 'easy', muted = false;
  let s = { phase: 'menu', runs: 0, wickets: 0, balls: 0, history: [], practice: false, time: 0, swing: 0, side: 1 };
  let bests = {};
  try { bests = JSON.parse(localStorage.getItem('liam-boundary-bests') || '{}') || {}; } catch (_) { /* Storage is optional. */ }
  const bestScore = () => Number(bests[difficulty]) || 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a,b,t) => a+(b-a)*t;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener('resize', resize); resize();
  function overlay(id) {
    ['menu','pause','results'].forEach(name => $(name).classList.toggle('hidden', name !== id));
    $('left').disabled = $('right').disabled = !!id;
    $('pauseButton').disabled = id === 'menu' || id === 'results';
    if (id) $(id).querySelector('button').focus({preventScroll:true});
  }
  function feedback(title, detail) {
    $('feedback').querySelector('b').textContent = title;
    $('feedback').querySelector('span').textContent = detail;
    $('feedback').classList.toggle('show', !!title);
  }
  function hud() {
    $('score').innerHTML = s.runs + '<span>/' + s.wickets + '</span>';
    $('overs').textContent = s.practice ? 'PRACTICE · NO LIMIT' : Math.floor(s.balls/6)+'.'+s.balls%6+' / 2 OVERS';
    $('target').textContent = bestScore();
    const start = s.balls > 0 && s.balls % 6 === 0 ? s.balls - 6 : Math.floor(s.balls/6)*6;
    $('balls').replaceChildren(...Array.from({length:6}, (_, i) => {
      const chip = document.createElement('span'), n = s.history[start+i];
      chip.className = 'ball-chip'+(n === 'W' ? ' wicket' : n >= 4 ? ' boundary' : '');
      chip.textContent = n === undefined ? '·' : n;
      return chip;
    }));
  }
  function start(practice) {
    audio.resume();
    s = {phase:'ready',runs:0,wickets:0,balls:0,history:[],practice,time:0,swing:0,side:1,fours:0,sixes:0,paused:false};
    overlay(null); feedback('READY, LIAM?', 'Watch the ball. Hit left or right.'); hud();
    $('instruction').textContent = practice ? 'PRACTICE · HIT AT THE GOLD CREASE' : '12 BALLS · 3 WICKETS · MAKE THEM COUNT';
  }
  function nextBall() {
    s.phase='runup'; s.time=0; s.swing=0; s.result=null; s.pending=null;
    // A balanced shuffled bag avoids a long run of balls on just one side.
    if (!s.bag || !s.bag.length) {
      s.bag=[-1,-1,-1,1,1,1];
      for (let i=5;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}
    }
    s.line=s.bag.pop()*(.72+Math.random()*.28);
    s.flight=rules.levels[difficulty].flight*(.94+Math.random()*.14);
    s.bounce=.58+Math.random()*.08;
    feedback('', '');
    $('instruction').textContent = s.practice ? 'WATCH IT BOUNCE. HIT AT THE GOLD LINE.' : 'WATCH THE BALL. TRUST YOUR TIMING.';
  }
  function shot(side) {
    if(s.paused || s.phase!=='delivery' || s.pending) return;
    s.side=side; s.swing=.001;
    s.pending=rules.judge(s.time-s.flight,side,s.line,difficulty);
    const button=$(side<0?'left':'right'); button.classList.add('pressed');
    setTimeout(()=>button.classList.remove('pressed'),140);
    // Misses continue to the wicket rather than teleporting away on an early press.
    if (!s.pending.wicket) resolve(s.pending);
  }
  function resolve(result) {
    s.result=result; s.phase='result'; s.time=0;
    s.runs+=result.runs; s.wickets+=Number(result.wicket); s.balls++;
    s.history.push(result.wicket?'W':result.runs);
    if(result.runs===4)s.fours++; if(result.runs===6)s.sixes++;
    feedback(result.title,result.detail); hud();
    if(result.wicket) {audio.stumps();audio.groan();}
    else {audio.bat(result.runs>=4?1:.55);if(result.runs>=4)audio.applause(result.runs/6);}
    $('instruction').textContent=s.practice?'PRACTICE · ESC TO FINISH':`${Math.max(0,12-s.balls)} BALLS LEFT · ${Math.max(0,3-s.wickets)} WICKETS IN HAND`;
  }
  function finish() {
    s.phase='finished'; feedback('','');
    const record=s.runs>bestScore();
    if(record) {bests[difficulty]=s.runs;try{localStorage.setItem('liam-boundary-bests',JSON.stringify(bests));}catch(_){}}
    $('resultEyebrow').textContent=record?'NEW PERSONAL BEST':'INNINGS COMPLETE';
    $('resultTitle').textContent=s.runs>=36?'TAKE A BOW, LIAM!':s.runs>=16?'NICE KNOCK, LIAM!':'ANOTHER GO, LIAM?';
    $('finalScore').textContent=s.runs+'/'+s.wickets;
    $('resultMessage').textContent=`${s.balls} balls faced at Findex Oval. `+(s.runs<16?'Wait for the bounce, then time your swing.':'The Warriors will take that!');
    $('fours').textContent=s.fours; $('sixes').textContent=s.sixes; $('best').textContent=bestScore();
    hud(); overlay('results');
  }
  function pause() {
    if(['menu','finished'].includes(s.phase))return;
    s.paused=!s.paused;overlay(s.paused?'pause':null);
  }
  function home() {s.phase='menu';s.paused=false;feedback('','');overlay('menu');}
  $('play').onclick=()=>start(false);$('practice').onclick=()=>start(true);
  $('again').onclick=()=>start(false);$('home').onclick=$('quit').onclick=home;
  $('pauseButton').onclick=$('resume').onclick=pause;
  $('sound').onclick=()=>{muted=!muted;audio.setEnabled(!muted);$('sound').textContent=muted?'×':'♪';$('sound').setAttribute('aria-pressed',String(!muted));};
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>{
    difficulty=button.dataset.difficulty;
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));hud();
  });
  $('left').addEventListener('pointerdown',e=>{e.preventDefault();shot(-1);});
  $('right').addEventListener('pointerdown',e=>{e.preventDefault();shot(1);});
  // Keyboard activation of the on-screen controls remains accessible.
  $('left').onclick=e=>{if(e.detail===0)shot(-1);};$('right').onclick=e=>{if(e.detail===0)shot(1);};
  addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(e.key==='Escape'){pause();return;}
    const key=e.key.toLowerCase();
    if(['arrowleft','arrowright','a','d'].includes(key)&&!['menu','finished'].includes(s.phase)){
      e.preventDefault();shot(key==='arrowleft'||key==='a'?-1:1);
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!s.paused&&!['menu','finished'].includes(s.phase))pause();});
  function update(dt) {
    if(s.paused || ['menu','finished'].includes(s.phase))return;
    s.time+=dt;if(s.swing)s.swing+=dt;
    if(s.phase==='ready'&&s.time>1.65)nextBall();
    else if(s.phase==='runup'&&s.time>1.05){s.phase='delivery';s.time=0;}
    else if(s.phase==='delivery') {
      if(s.pending&&s.time>=s.flight)resolve(s.pending);
      else if(s.time>s.flight+rules.levels[difficulty].window*1.65)resolve({runs:0,wicket:true,title:'BOWLED!',detail:'No shot — press left or right as it reaches Liam'});
    } else if(s.phase==='result'&&s.time>(s.result.runs>=4?2.15:1.65)) {
      if(rules.complete(s))finish();else nextBall();
    }
  }
  // All drawing uses a fixed front-on view. No camera cuts during a delivery.
  function poly(points,fill,stroke,line=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function ellipse(x,y,rx,ry,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function line(x,y,x2,y2,color,w){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function text(str,x,y,size,color,align='center'){ctx.font=`900 ${size}px Arial`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(str,x,y);}
  function geometry(){
    const narrow=width<650,short=height<500;
    return {cx:width/2,far:height*(short?.46:.40),near:height*(short?.72:narrow?.77:.81),scale:Math.min(Math.max(width/1050,.68),height/680),spread:Math.min(width*.20,180)};
  }
  function ground(g) {
    const horizon=height*(height<500?.38:.31);
    const sky=ctx.createLinearGradient(0,80,0,horizon);sky.addColorStop(0,'#8ac7de');sky.addColorStop(1,'#e2eddd');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // Soft clouds and rolling Gippsland hills.
    for(let i=0;i<5;i++){const x=(i*.26+.06)*width;ellipse(x,horizon*.62,48,12,'#edf5ed90');ellipse(x+20,horizon*.59,34,17,'#edf5ed90');}
    poly([[0,horizon],[0,horizon-23],[width*.18,horizon-51],[width*.4,horizon-18],[width*.65,horizon-44],[width,horizon-14],[width,horizon]],'#7caba1');
    for(let i=0;i<36;i++){const x=i*width/35;const h=16+(Math.sin(i*17)+1)*13;ctx.fillStyle='#537c64';ctx.fillRect(x-2,horizon-h,4,h);ellipse(x,horizon-h,12+(i%3)*4,h*.7,i%2?'#547c63':'#628a6b');}
    ctx.fillStyle='#6baa60';ctx.fillRect(0,horizon,width,height-horizon);
    for(let i=0;i<9;i++){const y=horizon+(height-horizon)*(i/9)**1.6;const y2=horizon+(height-horizon)*((i+1)/9)**1.6;ctx.fillStyle=i%2?'#6eaf63':'#75b568';ctx.fillRect(0,y,width,y2-y);}
    // Local pavilion, boundary boards and lights are stylised, not a surveyed recreation.
    const bx=width*.12,by=horizon-10,bw=Math.min(190,width*.21);
    ctx.fillStyle='#e5dfc9';ctx.fillRect(bx,by-40,bw,43);poly([[bx-10,by-40],[bx+bw*.4,by-63],[bx+bw+10,by-40]],'#35596a');
    for(let i=0;i<5;i++){ctx.fillStyle='#536f78';ctx.fillRect(bx+10+i*bw/5,by-29,bw/8,23);}
    ctx.fillStyle='#244d6d';ctx.fillRect(bx-4,by-3,bw+8,14);text('WESTERN PARK',bx+bw/2,by+7,8,'#edf4ed');
    const boardX=width*.80;ctx.fillStyle='#193c45';ctx.fillRect(boardX-52,by-47,104,47);text('FINDEX OVAL',boardX,by-34,9,'#c7d9b8');text(`${s.runs} / ${s.wickets}`,boardX,by-11,18,'#ffdf77');line(boardX-40,by,boardX-40,by+15,'#506751',4);line(boardX+40,by,boardX+40,by+15,'#506751',4);
    [width*.06,width*.94].forEach(x=>{line(x,horizon+8,x,horizon-99,'#b7c4bc',3);ctx.fillStyle='#dee3d6';ctx.fillRect(x-17,horizon-104,34,11);});
    // Boundary rope and a few parents on the grass.
    ctx.strokeStyle='#f1ead6';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(g.cx,horizon+16,width*.66,height*.31,0,0,Math.PI);ctx.stroke();
    for(let i=0;i<16;i++){const x=width*(.02+i*.064),y=horizon+12+(i%3)*4;ellipse(x,y-9,3,3,'#dbaf89');line(x,y-5,x,y+3,i%2?'#274c75':'#ddcbb1',5);}
    // Pitch with a broad, readable near crease.
    poly([[g.cx-22,g.far-12],[g.cx+22,g.far-12],[g.cx+g.spread*.73,g.near+25],[g.cx-g.spread*.73,g.near+25]],'#d8c28a');
    poly([[g.cx-13,g.far],[g.cx+15,g.far],[g.cx+g.spread*.50,g.near+25],[g.cx-g.spread*.48,g.near+25]],'#dfca94');
    for(let i=0;i<48;i++){const t=(i*.618)%1,x=g.cx+Math.sin(i*14)*mix(12,g.spread*.56,t);line(x,mix(g.far,g.near,t),x+2,mix(g.far,g.near,t)+1,'#b69f6a55',1);}
    line(g.cx-35,g.far+12,g.cx+35,g.far+12,'#f8f3d8',2);
    line(g.cx-g.spread*.85,g.near-3,g.cx+g.spread*.85,g.near-3,'#fff0ba',4);
    if(s.practice){line(g.cx-g.spread*.7,g.near-8,g.cx+g.spread*.7,g.near-8,'#ffd25c',3);text('HIT HERE',g.cx+g.spread*.94,g.near-5,10,'#173b38','left');}
    stumps(g.cx,g.far+3,23*g.scale,false);
  }
  function stumps(x,y,h,broken){for(let i=-1;i<=1;i++)line(x+i*h*.15,y,x+i*h*.15+(broken?i*h*.7:0),y-h,'#f8ecce',Math.max(2,h*.075));if(!broken)line(x-h*.21,y-h,x+h*.21,y-h,'#fff5d7',Math.max(2,h*.06));else{line(x-h*.8,y-h*1.2,x-h*.4,y-h*1.3,'#fff5d7',3);}}
  function person(x,y,h,role,pose=0,side=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(h/100,h/100);
    ellipse(0,2,21,5,'#28533340');
    const bat=role==='batter', ump=role==='umpire', kit=bat?'#256dc0':ump?'#e8e6d7':'#e97d41';
    const stride=bat?0:Math.sin(pose)*12;
    line(-7,-39,-10-stride,0,ump?'#293d47':'#f6efdc',10);line(7,-39,11+stride,0,ump?'#293d47':'#f6efdc',10);
    line(-11-stride,1,-4-stride,1,'#213b49',6);line(10+stride,1,18+stride,1,'#213b49',6);
    poly([[-17,-76],[14,-76],[12,-39],[-12,-39]],kit,'#173a5150',1.2);
    line(-12,-66,12,-66,bat?'#aed6fa':'#ffe4ba',3);
    ellipse(0,-88,11,12,'#e6b187');
    if(bat){ellipse(-2,-93,13,10,'#164982');line(-13,-87,13,-87,'#123b60',4);line(4,-84,13,-82,'#beced4',2);line(13,-82,10,-74,'#beced4',2);}
    else {ellipse(0,-97,12,4,ump?'#fff9dc':'#b9572b');if(ump)line(-18,-94,18,-94,'#fff9dc',4);}
    if(bat){
      // White pads and an oversized willow bat make the contact point clear.
      line(-10,-28,-11,-5,'#fff7dc',12);line(9,-28,11,-5,'#fff7dc',12);
      for(let i=0;i<3;i++){line(-14,-23+i*7,-6,-23+i*7,'#c7c7b5',1);line(5,-23+i*7,14,-23+i*7,'#c7c7b5',1);}
      const progress=s.swing?clamp(s.swing/.24,0,1):0;
      const angle=s.swing?mix(-1.1,side*1.9,progress):-.35;
      const hx=side*(s.swing?13:8),hy=-53;
      line(-14,-70,hx,hy,kit,9);line(14,-70,hx+3,hy+3,kit,9);ellipse(hx,hy,6,5,'#fff4d6');
      ctx.save();ctx.translate(hx,hy);ctx.rotate(angle);line(0,0,0,16,'#324854',5);line(0,17,0,49,'#efd39a',11);line(-2,21,-2,46,'#fff0c4',2);ctx.restore();
      text('LIAM',0,-49,7,'#eaf3ff');
    }else{
      const release=s.phase==='delivery'&&role==='bowler';
      line(-15,-71,-21+stride,-44,kit,8);line(15,-71,release?8:23-stride,release?-119:-44,kit,8);
      ellipse(release?8:23-stride,release?-119:-44,4,4,'#e6b187');
    }
    ctx.restore();
  }
  function ballPosition(g) {
    const t=clamp(s.time/s.flight,0,1.18),pers=t*t*.45+t*.55;
    const groundY=mix(g.far,g.near,pers);
    const x=g.cx+s.line*g.spread*.38*pers;
    let z;
    if(t<s.bounce)z=44*g.scale*(1-t/s.bounce);
    else {const u=(t-s.bounce)/(1-s.bounce);z=Math.sin(clamp(u,0,1)*Math.PI)*29*g.scale;}
    return {x,y:groundY-z,groundY,r:mix(3,8,clamp(t,0,1))*Math.max(.7,g.scale)};
  }
  function drawBall(x,y,r,shadowY){
    ellipse(x,shadowY,r*1.3,r*.35,'#244b3b40');ellipse(x,y,r+2,r+2,'#fff5d4');ellipse(x,y,r,r,'#bc382e');line(x-r*.35,y-r*.7,x+r*.3,y+r*.7,'#ffe0b4',Math.max(1,r*.2));
  }
  function draw() {
    ctx.clearRect(0,0,width,height);const g=geometry();ground(g);
    // Fielders stay in the shot; runs are resolved quickly for arcade pacing.
    [[.14,.53],[.29,.43],[.74,.44],[.89,.56],[.08,.76],[.93,.77]].forEach(([x,y],i)=>{
      let px=width*x,py=height*y;
      if(s.phase==='result'&&s.result.runs>0&&Math.sign(px-g.cx)===s.side){px+=s.side*Math.min(s.time,1)*32;py+=Math.sin(i)*s.time*8;}
      person(px,py,48*g.scale,'fielder',s.phase==='result'?s.time*12:0);
    });
    person(g.cx-38*g.scale,g.far-6,60*g.scale,'umpire');
    const run=s.phase==='runup'?clamp(s.time/1.05,0,1):1;
    person(g.cx+12*g.scale,g.far-27*(1-run),70*g.scale,'bowler',s.phase==='runup'?s.time*19:0);
    const bh=clamp(136*g.scale,87,150);
    const shift=s.swing?clamp(s.swing/.13,0,1):0;
    const batterX=mix(g.cx-36*g.scale,g.cx+s.side*g.spread*.24,shift);
    stumps(g.cx,g.near+18,48*g.scale,s.phase==='result'&&s.result.wicket);
    person(batterX,g.near+20,bh,'batter',0,s.side);
    if(s.phase==='delivery'){
      const b=ballPosition(g);drawBall(b.x,b.y,b.r,b.groundY);
      if(s.practice){const t=clamp(s.time/s.flight,0,1);ctx.globalAlpha=.8;line(g.cx-45,g.near+40,g.cx+45,g.near+40,'#173b38',5);line(g.cx-45,g.near+40,g.cx-45+90*t,g.near+40,'#ffdc6d',5);ctx.globalAlpha=1;}
    }
    if(s.phase==='result'&&!s.result.wicket){
      const t=clamp(s.time/1.15,0,1),runs=s.result.runs;
      const x=g.cx+s.line*g.spread*.38+s.side*t*(runs>=4?width*.63:width*.24);
      const y=g.near-(runs===6?Math.sin(t*Math.PI*.7)*height*.67:t*height*.29);
      if(t<1){line(x-s.side*25,y+8,x,y,'#fff7d59c',3);drawBall(x,y,mix(7,3,t),g.near-t*height*.16);}
    }
    if(s.phase==='result'&&s.result.runs>=4){
      for(let i=0;i<32;i++){const t=s.time,x=width*((i*.618)%1),y=height*.12+t*(55+i%7*16);ctx.save();ctx.translate(x+Math.sin(i+t*3)*15,y);ctx.rotate(i+t*2);ctx.fillStyle=i%2?'#ffcf56':'#f4edcf';ctx.fillRect(-3,-2,6,4);ctx.restore();}
    }
  }
  function frame(now) {const dt=last?Math.min((now-last)/1000,.05):0;last=now;update(dt);draw();requestAnimationFrame(frame);}
  hud();overlay('menu');requestAnimationFrame(frame);
})();
