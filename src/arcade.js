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
    // Mix attacking straight deliveries with balls outside the wicket.
    s.line=s.bag.pop()*(s.balls%3===2 ? .08+Math.random()*.02 : .72+Math.random()*.28);
    s.flight=rules.levels[difficulty].flight*(.94+Math.random()*.14);
    s.bounce=.58+Math.random()*.08;
    feedback('', '');
    $('instruction').textContent = s.practice ? 'WATCH IT BOUNCE. HIT AT THE GOLD LINE.' : 'WATCH THE BALL. TRUST YOUR TIMING.';
  }
  function shot(side) {
    if(s.paused || s.phase!=='delivery' || s.pending) return;
    s.side=side; s.swing=.12;
    s.pending=rules.judge(s.time-s.flight,side,s.line,difficulty);
    const button=$(side<0?'left':'right'); button.classList.add('pressed');
    setTimeout(()=>button.classList.remove('pressed'),140);
    // Misses continue to the wicket rather than teleporting away on an early press.
    if (!s.pending.missed) resolve(s.pending);
  }
  function resolve(result) {
    s.result=result; s.phase='result'; s.time=0;
    s.runs+=result.runs; s.wickets+=Number(result.wicket); s.balls++;
    s.history.push(result.wicket?'W':result.runs);
    if(result.runs===4)s.fours++; if(result.runs===6)s.sixes++;
    feedback(result.title,result.detail); hud();
    if(result.wicket) {audio.stumps();audio.groan();}
    else if(!result.missed) {audio.bat(result.runs>=4?1:.55);if(result.runs>=4)audio.applause(result.runs/6);}
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
      if(s.pending&&s.time>=s.flight+.16)resolve(s.pending);
      else if(s.time>s.flight+.16)resolve(rules.miss(s.line,'No shot'));
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
    const ropeTop=horizon+16,ropeBottom=height*1.13;
    ctx.strokeStyle='#f1ead6';ctx.lineWidth=3;ctx.beginPath();
    ctx.ellipse(g.cx,(ropeTop+ropeBottom)/2,width*.61,(ropeBottom-ropeTop)/2,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<16;i++){const x=width*(.02+i*.064),y=horizon+12+(i%3)*4;ellipse(x,y-9,3,3,'#dbaf89');line(x,y-5,x,y+3,i%2?'#274c75':'#ddcbb1',5);}
    // Pitch with a broad, readable near crease.
    poly([[g.cx-22,g.far-12],[g.cx+22,g.far-12],[g.cx+g.spread*.73,g.near+25],[g.cx-g.spread*.73,g.near+25]],'#d8c28a');
    poly([[g.cx-13,g.far],[g.cx+15,g.far],[g.cx+g.spread*.50,g.near+25],[g.cx-g.spread*.48,g.near+25]],'#dfca94');
    for(let i=0;i<48;i++){const t=(i*.618)%1,x=g.cx+Math.sin(i*14)*mix(12,g.spread*.56,t);line(x,mix(g.far,g.near,t),x+2,mix(g.far,g.near,t)+1,'#b69f6a55',1);}
    line(g.cx-35,g.far+12,g.cx+35,g.far+12,'#f8f3d8',2);
    line(g.cx-25,g.far+3,g.cx+25,g.far+3,'#f8f3d8',2);
    [-1,1].forEach(sign=>line(g.cx+sign*25,g.far-7,g.cx+sign*28,g.far+12,'#f8f3d8',2));
    line(g.cx-g.spread*.85,g.near-3,g.cx+g.spread*.85,g.near-3,'#fff0ba',4);
    const wicketY=g.near+28*g.scale;
    line(g.cx-g.spread*.59,wicketY,g.cx+g.spread*.59,wicketY,'#fff0ba',2);
    [-1,1].forEach(sign=>line(g.cx+sign*g.spread*.57,g.near-3,g.cx+sign*g.spread*.65,wicketY+8,'#fff0ba',2));
    if(s.practice){line(g.cx-g.spread*.7,g.near-8,g.cx+g.spread*.7,g.near-8,'#ffd25c',3);text('HIT HERE',g.cx+g.spread*.94,g.near-5,10,'#173b38','left');}
  }
  function stumps(x,y,h,broken){for(let i=-1;i<=1;i++)line(x+i*h*.15,y,x+i*h*.15+(broken?i*h*.7:0),y-h,'#f8ecce',Math.max(2,h*.075));if(!broken)line(x-h*.21,y-h,x+h*.21,y-h,'#fff5d7',Math.max(2,h*.06));else{line(x-h*.8,y-h*1.2,x-h*.4,y-h*1.3,'#fff5d7',3);}}
  // An authentic side-on cricket batsman holding the bat with normal hands.
  // Profile faces down the pitch with an athletic forward lean over the popping crease,
  // white batting pads, helmet peak focused on the bowler, and gloved hands gripping the handle.
  function batter(x,y,h) {
    ctx.save();ctx.translate(x,y);ctx.scale(h/100,h/100);

    const t=s.swing?clamp(s.swing/.38,0,1):0;
    const isDelivery=s.phase==='delivery'&&!s.swing;
    const isResult=s.phase==='result';
    const isWicket=isResult&&s.result&&s.result.wicket;
    const isBoundary=isResult&&s.result&&s.result.runs>=4;

    // Rhythmic bat tap in ready stance
    const tap=(!s.swing&&!isDelivery&&!isResult)?(Math.sin(s.time*8)>0.25?-2.5:0):0;

    // Backlift as bowler delivers
    const lift=isDelivery?clamp(s.time/(s.flight*.82),0,1):0;
    const liftEase=Math.sin(lift*Math.PI*.5);

    let grip={x:10,y:-41+tap};
    let toe={x:12,y:1+Math.max(0,tap)};
    let bodyTilt=0;
    let frontStep=0;
    let headTurn=0;

    if(lift>0){
      grip={x:mix(10,5,liftEase),y:mix(-41,-56,liftEase)};
      toe={x:mix(12,-16,liftEase),y:mix(1,-62,liftEase)};
      bodyTilt=-liftEase*2;
    }else if(s.swing){
      if(s.side<0){
        // HIT LEFT (Leg Side: Pull / Hook / Flick)
        if(t<.34){
          const u=t/.34,uEase=u*u;
          grip={x:mix(6,12,uEase),y:mix(-56,-40,uEase)};
          toe={x:mix(-15,16,uEase),y:mix(-62,-16,uEase)};
          frontStep=Math.sin(u*Math.PI*.5)*4;
        }else{
          const u=(t-.34)/.66,uEase=Math.sin(u*Math.PI*.5);
          grip={x:mix(12,-18,uEase),y:mix(-40,-64,uEase)};
          toe={x:mix(16,-34,uEase),y:mix(-16,-108,uEase)};
          bodyTilt=uEase*6;
          frontStep=4-uEase*2;
        }
      }else{
        // HIT RIGHT (Off Side: Cover Drive / Square Cut)
        if(t<.34){
          const u=t/.34,uEase=u*u;
          grip={x:mix(6,22,uEase),y:mix(-56,-42,uEase)};
          toe={x:mix(-15,30,uEase),y:mix(-62,-20,uEase)};
          frontStep=Math.sin(u*Math.PI*.5)*8;
          bodyTilt=uEase*4;
        }else{
          const u=(t-.34)/.66,uEase=Math.sin(u*Math.PI*.5);
          grip={x:mix(22,28,uEase),y:mix(-42,-68,uEase)};
          toe={x:mix(30,46,uEase),y:mix(-20,-114,uEase)};
          frontStep=8+uEase*2;
          bodyTilt=4-uEase*2;
        }
      }
    }else if(isWicket){
      grip={x:9,y:-36};
      toe={x:11,y:1};
      headTurn=-1;
      bodyTilt=-3;
    }else if(isBoundary){
      if(s.side<0){
        grip={x:-18,y:-64};
        toe={x:-34,y:-108};
        bodyTilt=5;
      }else{
        grip={x:28,y:-68};
        toe={x:46,y:-114};
        bodyTilt=3;
        frontStep=9;
      }
    }

    // Shadow on turf
    ellipse(grip.x*.15+4,3,23,6,'#28533340');
    if(toe.y>-4)ellipse(toe.x,toe.y+1,7,2.5,'#28533330');

    // Vector calculations for bat
    const bdx=toe.x-grip.x,bdy=toe.y-grip.y;
    const batLen=Math.hypot(bdx,bdy)||1;
    const ux=bdx/batLen,uy=bdy/batLen;
    const nx=-uy,ny=ux;

    // Joint anchors
    const sxFar=9+bodyTilt,syFar=-74;
    const sxNear=3+bodyTilt,syNear=-73;
    const topGrip={x:grip.x-ux*6,y:grip.y-uy*6};
    const botGrip={x:grip.x,y:grip.y};
    const farElbow={x:mix(sxFar,topGrip.x,.45)+6,y:mix(syFar,topGrip.y,.5)+3};
    const nearElbow={x:mix(sxNear,botGrip.x,.45)+4,y:mix(syNear,botGrip.y,.5)+4};

    // 1. Far (Front) Leg - stepped forward, bent knee
    const fKneeX=9+frontStep*.6,fKneeY=-28;
    const fFootX=11+frontStep,fFootY=-1;
    line(2+bodyTilt,-47,fKneeX,fKneeY,'#1c5aa8',11);
    poly([[fKneeX-4,fKneeY-5],[fKneeX+5,fKneeY-3],[fFootX+5,fFootY-3],[fFootX-4,fFootY-3]],'#f4f5ee','#b8beaf',1.2);
    line(fKneeX-3,fKneeY,fKneeX+4,fKneeY,'#ccd1c2',2.2);
    line(fKneeX-3,fKneeY+7,fFootX-3,fFootY-4,'#d8ddd0',1.5);
    line(fKneeX+1,fKneeY+7,fFootX+1,fFootY-4,'#d8ddd0',1.5);
    line(fKneeX-4,fKneeY+4,fKneeX-2,fKneeY+4,'#8a948c',2);
    line(fFootX-4,fFootY-7,fFootX-2,fFootY-7,'#8a948c',2);
    poly([[fFootX-4,fFootY-2],[fFootX+8,fFootY-2],[fFootX+10,fFootY+1],[fFootX-5,fFootY+1]],'#ffffff','#ccd1c2',1);
    line(fFootX-5,fFootY+1.5,fFootX+10,fFootY+1.5,'#293f50',2);

    // 2. Near (Back) Leg - grounded near popping crease
    const bKneeX=-5,bKneeY=-27;
    const bFootX=-6,bFootY=0;
    line(-4+bodyTilt,-47,bKneeX,bKneeY,'#164887',11);
    poly([[bKneeX-4,bKneeY-5],[bKneeX+4,bKneeY-3],[bFootX+4,bFootY-3],[bFootX-4,bFootY-3]],'#ecefe5','#b2b8a8',1.2);
    line(bKneeX-3,bKneeY,bKneeX+3,bKneeY,'#c4cab9',2);
    poly([[bFootX-4,bFootY-2],[bFootX+7,bFootY-2],[bFootX+9,bFootY+1],[bFootX-5,bFootY+1]],'#ffffff','#ccd1c2',1);
    line(bFootX-5,bFootY+1.5,bFootX+9,bFootY+1.5,'#293f50',2);

    // 3. Side-on Torso leaning forward
    const hx=-3+bodyTilt,hy=-47;
    poly([[hx-4,hy],[hx+6,hy],[sxFar+3,syFar],[sxNear-3,syNear],[hx-4,hy]],'#1c5fa8','#113c6b',1.2);
    poly([[hx-4,hy],[hx,hy],[sxNear-1,syNear],[sxNear-3,syNear]],'#13467e');
    line(hx+1,hy,sxNear+1,syNear,'#ffd25c',2);

    // 4. Head, Neck & Helmet (Side-on profile)
    const neckX=7+bodyTilt,neckY=-76;
    const headX=(headTurn<0?3:11)+bodyTilt;
    const headY=-89;
    line(neckX,neckY,headX-1,headY+5,'#e5aa82',6.5);
    ellipse(headX,headY,11,10.5,'#15447b');
    ellipse(headX-2,headY-3,7,6,'#2261a8');

    if(headTurn>=0){
      poly([[headX+5,headY-1],[headX+16,headY-3],[headX+17,headY+1],[headX+8,headY+2]],'#0e325c');
      poly([[headX+5,headY+1],[headX+9,headY+3],[headX+7,headY+6],[headX+8,headY+9],[headX+2,headY+9]],'#e5aa82');
      ellipse(headX+6,headY+2,1.2,1.2,'#122338');
      line(headX-1,headY+3,headX+7,headY+8,'#b5c4cc',1.6);
      line(headX+2,headY+1,headX+7,headY+8,'#b5c4cc',1.4);
      line(headX+4,headY+4,headX+8,headY+7,'#b5c4cc',1.2);
    }else{
      poly([[headX-5,headY-1],[headX-15,headY-2],[headX-16,headY+2],[headX-8,headY+3]],'#0e325c');
      ellipse(headX-5,headY+3,1.2,1.2,'#122338');
    }

    // 5. Far (Front) Arm
    line(sxFar,syFar,farElbow.x,farElbow.y,'#1c5fa8',7);
    line(farElbow.x,farElbow.y,farElbow.x+ux*1.5,farElbow.y+uy*1.5,'#ffd25c',7);
    line(farElbow.x,farElbow.y,topGrip.x,topGrip.y,'#e5aa82',5.5);

    // 6. Cricket Bat
    const knobX=grip.x-ux*13,knobY=grip.y-uy*13;
    const spliceX=grip.x+ux*8,spliceY=grip.y+uy*8;
    line(knobX,knobY,spliceX,spliceY,'#f2efe9',4.2);
    for(let r=-11;r<=6;r+=2.5){
      const rx=grip.x+ux*r,ry=grip.y+uy*r;
      line(rx-nx*1.8,ry-ny*1.8,rx+nx*1.8,ry+ny*1.8,'#d8d4c7',.8);
    }
    ellipse(knobX,knobY,2.4,2,'#e0dcce');

    const shoulder1=[spliceX+nx*3.6,spliceY+ny*3.6];
    const shoulder2=[spliceX-nx*3.6,spliceY-ny*3.6];
    const toe1=[toe.x+nx*4.2,toe.y+ny*4.2];
    const toe2=[toe.x-nx*4.2,toe.y-ny*4.2];
    poly([shoulder2,toe2,[toe.x,toe.y],[spliceX,spliceY]],'#c8a466');
    poly([[spliceX,spliceY],shoulder1,toe1,[toe.x,toe.y]],'#faeed2','#bfa065',1);
    line(spliceX,spliceY,toe.x,toe.y,'#e5d1a4',1);

    const sTopX=spliceX+(toe.x-spliceX)*.15,sTopY=spliceY+(toe.y-spliceY)*.15;
    const sBotX=spliceX+(toe.x-spliceX)*.55,sBotY=spliceY+(toe.y-spliceY)*.55;
    line(sTopX,sTopY,sBotX,sBotY,'#d32f2f',3);
    line(sTopX,sTopY,sTopX+(sBotX-sTopX)*.7,sTopY+(sBotY-sTopY)*.7,'#ffd25c',1.8);

    // Batting glove drawer helper
    function drawGlove(gx,gy){
      ctx.save();ctx.translate(gx,gy);
      const ang=Math.atan2(uy,ux);ctx.rotate(ang);
      poly([[-4,-3],[-4,3],[-1,3],[-1,-3]],'#1c5fa8');
      poly([[-1,-4.5],[6,-4.5],[7,4.5],[-1,4.5]],'#f5f7fa','#d0d7de',1);
      for(let f=0;f<3;f++){
        const fx=.5+f*2.2;
        poly([[fx,-4.2],[fx+1.8,-4.2],[fx+1.8,1.2],[fx,1.2]],'#e9ecef','#bec5cb',.8);
        line(fx+.4,-2.5,fx+1.4,-2.5,'#1c5fa8',1);
      }
      poly([[1,2.5],[5,2.5],[4.5,4.8],[.5,4.8]],'#e9ecef','#bec5cb',.8);
      ctx.restore();
    }

    // 7. Top Glove (Left Hand)
    drawGlove(topGrip.x,topGrip.y);

    // 8. Near (Back) Arm
    line(sxNear,syNear,nearElbow.x,nearElbow.y,'#1c5fa8',7.5);
    line(nearElbow.x,nearElbow.y,nearElbow.x+ux*1.5,nearElbow.y+uy*1.5,'#ffd25c',7.5);
    line(nearElbow.x,nearElbow.y,botGrip.x,botGrip.y,'#e5aa82',5.8);

    // 9. Bottom Glove (Right Hand)
    drawGlove(botGrip.x,botGrip.y);

    ctx.restore();
  }
  function person(x,y,h,role,pose=0) {
    ctx.save();ctx.translate(x,y);ctx.scale(h/100,h/100);
    ellipse(0,2,21,5,'#28533340');
    const ump=role==='umpire',kit=ump?'#e8e6d7':role==='partner'?'#256dc0':'#e97d41';
    const stride=Math.sin(pose)*12;
    line(-7,-39,-10-stride,0,ump?'#293d47':'#f6efdc',10);line(7,-39,11+stride,0,ump?'#293d47':'#f6efdc',10);
    line(-11-stride,1,-4-stride,1,'#213b49',6);line(10+stride,1,18+stride,1,'#213b49',6);
    poly([[-17,-76],[14,-76],[12,-39],[-12,-39]],kit,'#173a5150',1.2);
    line(-12,-66,12,-66,'#ffe4ba',3);
    ellipse(0,-88,11,12,'#e6b187');
    ellipse(0,-97,12,4,ump?'#fff9dc':role==='partner'?'#164982':'#b9572b');
    if(ump)line(-18,-94,18,-94,'#fff9dc',4);
    const release=s.phase==='delivery'&&role==='bowler';
    const follow=release?clamp((s.time-.10)/.30,0,1):0;
    const handX=release?mix(8,-14,follow):23-stride;
    const handY=release?mix(-119,-40,follow):-44;
    line(-15,-71,-21+stride,-44,kit,8);line(15,-71,handX,handY,kit,8);
    ellipse(handX,handY,4,4,'#e6b187');
    if(role==='partner')line(23,-43,28,0,'#e8c789',7);
    ctx.restore();
  }
  function ballPosition(g) {
    const t=clamp(s.time/s.flight,0,1),pers=t*t*.45+t*.55;
    const past=clamp((s.time-s.flight)/.16,0,1);
    const groundY=mix(g.far,g.near,pers)+past*28*g.scale;
    const x=mix(g.cx+35.6*g.scale,g.cx+s.line*g.spread*.38,pers);
    let z;
    if(t<s.bounce)z=83.3*g.scale*(1-t/s.bounce);
    else {const u=(t-s.bounce)/(1-s.bounce);z=(45*u-31*u*u)*g.scale*(1-past*.5);}
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
    // The bowler's-end umpire looks straight down the pitch from behind the wicket.
    person(g.cx,g.far-28*g.scale,60*g.scale,'umpire');
    stumps(g.cx,g.far+3,23*g.scale,false);
    person(g.cx-48*g.scale,g.far+10,62*g.scale,'partner');
    person(g.cx-Math.min(width*.39,360),g.near-3,65*g.scale,'umpire');
    const run=s.phase==='runup'?clamp(s.time/1.05,0,1):1;
    person(g.cx+30*g.scale,g.far-27*(1-run),70*g.scale,'bowler',s.phase==='runup'?s.time*19:0);
    const bh=clamp(136*g.scale,87,150);
    const batterX=g.cx-20*g.scale;
    // Smaller screen Y is up the pitch: Liam stands at the popping crease,
    // ahead of his wicket. Draw the nearer stumps last for correct overlap.
    batter(batterX,g.near-3,bh);
    stumps(g.cx,g.near+28*g.scale,48*g.scale,s.phase==='result'&&s.result.wicket);
    if(s.phase==='delivery'){
      const b=ballPosition(g);drawBall(b.x,b.y,b.r,b.groundY);
      if(s.practice){const t=clamp(s.time/s.flight,0,1);ctx.globalAlpha=.8;line(g.cx-45,g.near+40,g.cx+45,g.near+40,'#173b38',5);line(g.cx-45,g.near+40,g.cx-45+90*t,g.near+40,'#ffdc6d',5);ctx.globalAlpha=1;}
    }
    if(s.phase==='result'&&!s.result.wicket&&!s.result.missed){
      const t=clamp(s.time/1.15,0,1),runs=s.result.runs;
      const x=g.cx+s.line*g.spread*.38+s.side*t*(runs>=4?width*.63:width*.24);
      const y=g.near-14*g.scale-(runs===6?Math.sin(t*Math.PI*.7)*height*.67:t*height*.29);
      if(t<1){line(x-s.side*25,y+8,x,y,'#fff7d59c',3);drawBall(x,y,mix(7,3,t),g.near-t*height*.16);}
    }
    if(s.phase==='result'&&s.result.runs>=4){
      for(let i=0;i<32;i++){const t=s.time,x=width*((i*.618)%1),y=height*.12+t*(55+i%7*16);ctx.save();ctx.translate(x+Math.sin(i+t*3)*15,y);ctx.rotate(i+t*2);ctx.fillStyle=i%2?'#ffcf56':'#f4edcf';ctx.fillRect(-3,-2,6,4);ctx.restore();}
    }
  }
  function frame(now) {const dt=last?Math.min((now-last)/1000,.05):0;last=now;update(dt);draw();requestAnimationFrame(frame);}
  hud();overlay('menu');requestAnimationFrame(frame);
})();
