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
  // Western Park Reserve, Warragul, from the southern end of the oval. The
  // aerial references set the layout: the clubrooms and their water tank on
  // the western side, the long pale indoor centre away to the north-east, a
  // gum line along the northern boundary with the estate's roofs behind it,
  // and a white post fence right around the ring. Distances are compressed
  // for a phone screen, so this is the ground's furniture in the right
  // places, not a surveyed recreation.
  function skyline(horizon) {
    const sky=ctx.createLinearGradient(0,80,0,horizon);sky.addColorStop(0,'#8ac7de');sky.addColorStop(1,'#e2eddd');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    for(let i=0;i<5;i++){const x=(i*.26+.06)*width;ellipse(x,horizon*.62,48,12,'#edf5ed90');ellipse(x+20,horizon*.59,34,17,'#edf5ed90');}
    // Light industrial roofs and the road that run behind the northern trees.
    for(let i=0;i<8;i++){const w=width*(.06+(i%3)*.025),x=width*.02+i*width*.125,h=15+(i%3)*7;
      ctx.fillStyle=i%2?'#c3cbc8':'#b4bebd';ctx.fillRect(x,horizon-21-h,w,h);
      poly([[x-4,horizon-21-h],[x+w/2,horizon-28-h],[x+w+4,horizon-21-h]],'#9daaa8');}
    ctx.fillStyle='#9ba5a4';ctx.fillRect(0,horizon-23,width,8);
    // Two ranks of gums: a dark wall behind, lighter crowns in front of it.
    for(let i=0;i<26;i++){const x=i*width/25+(i%2?9:-9),h=30+(Math.sin(i*13)+1)*12;ellipse(x,horizon-h,17+(i%3)*6,h*.55,'#2f5544');}
    for(let i=0;i<20;i++){const x=i*width/19,h=20+(Math.sin(i*7)+1)*10;
      ctx.fillStyle='#4c6b52';ctx.fillRect(x-2.5,horizon-h+3,5,h);ellipse(x,horizon-h,14+(i%3)*5,h*.62,i%2?'#3d6f50':'#4a7d59');}
  }
  // Western side: the social room under its red gable, the long open shelter
  // beside it, the round water tank on the corner and the car park kerbside.
  // Cars are laid down before the buildings so the fascia never sits on them.
  function clubrooms(horizon,k) {
    const base=horizon-2,w=Math.min(160,width*.20),x=width*.03;
    for(let i=0;i<5;i++){const c=x+4+i*22*k;ctx.fillStyle=['#b9483c','#cfd3cf','#3c5d86','#d8c96a','#8d949a'][i];
      ctx.fillRect(c,base-7*k,17*k,8*k);ctx.fillStyle='#ffffff33';ctx.fillRect(c+4*k,base-11*k,9*k,5*k);}
    ctx.fillStyle='#d9d5bd';ctx.fillRect(x-8*k,base-48*k,32*k,34*k);ellipse(x+8*k,base-48*k,16*k,7*k,'#eae6d2');
    ctx.fillStyle='#e4e2d6';ctx.fillRect(x+28*k,base-27*k,w*.55,25*k);
    poly([[x+24*k,base-27*k],[x+32*k+w*.55,base-27*k],[x+28*k+w*.55,base-35*k],[x+32*k,base-37*k]],'#c9cec9');
    const cx=x+28*k+w*.5;
    ctx.fillStyle='#efe9d6';ctx.fillRect(cx,base-39*k,w*.62,37*k);
    poly([[cx-9*k,base-39*k],[cx+w*.31,base-57*k],[cx+w*.62+9*k,base-39*k]],'#9c4436');
    for(let i=0;i<4;i++){ctx.fillStyle='#63808a';ctx.fillRect(cx+7*k+i*w*.145,base-31*k,w*.09,17*k);}
    ctx.fillStyle='#244d6d';ctx.fillRect(cx,base-10*k,w*.62,11*k);
    if(w>110)text('WESTERN PARK',cx+w*.31,base-2*k,7,'#edf4ed');
  }
  // North-east: the big pale indoor centre standing clear of the treeline.
  function indoorCentre(horizon,k) {
    const w=Math.min(290,width*.29),x=width*.70,base=horizon-2;
    ctx.fillStyle='#e8ebe9';ctx.fillRect(x,base-33*k,w,31*k);
    poly([[x-9*k,base-33*k],[x+w*.42,base-48*k],[x+w+9*k,base-33*k]],'#d3d9da');
    for(let i=1;i<6;i++)line(x+i*w/6,base-31*k,x+i*w/6,base-3,'#d7dcda',2);
    ctx.fillStyle='#c3cac9';ctx.fillRect(x+w*.60,base-19*k,w*.2,17*k);
  }
  // A white post-and-rail fence just inside the perimeter path, the way the
  // ring of posts reads from above.
  function fence(g,horizon) {
    const top=horizon+16,bottom=height*1.13,cy=(top+bottom)/2,rx=width*.61,ry=(bottom-top)/2;
    ctx.strokeStyle='#cbcabc';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(g.cx,cy,rx+14,ry+12,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f4efdd';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(g.cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<=64;i++){const a=Math.PI+Math.PI*i/64,x=g.cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
      if(y>height)continue;
      const h=mix(6,17,clamp((y-top)/(height*.62-top),0,1));line(x,y-h*.35,x,y+h*.65,'#f7f2e2',2.4);}
  }
  function ground(g) {
    const horizon=height*(height<500?.38:.31);
    // One scale for the ground's furniture, so a phone gets the same layout
    // rather than a few landmarks sized for a desktop.
    const k=clamp(width/1050,.62,1.1);
    skyline(horizon);
    ctx.fillStyle='#6baa60';ctx.fillRect(0,horizon,width,height-horizon);
    for(let i=0;i<9;i++){const y=horizon+(height-horizon)*(i/9)**1.6;const y2=horizon+(height-horizon)*((i+1)/9)**1.6;ctx.fillStyle=i%2?'#6eaf63':'#75b568';ctx.fillRect(0,y,width,y2-y);}
    clubrooms(horizon,k);indoorCentre(horizon,k);
    // Scoreboard on its legs beyond the northern boundary.
    const boardX=width*.585,by=horizon-2,bw=92*k,bh=42*k;
    ctx.fillStyle='#193c45';ctx.fillRect(boardX-bw/2,by-bh-2,bw,bh);
    text('FINDEX OVAL',boardX,by-bh*.68,8*k,'#c7d9b8');text(`${s.runs} / ${s.wickets}`,boardX,by-bh*.2,16*k,'#ffdf77');
    line(boardX-bw*.37,by-2,boardX-bw*.37,by+12*k,'#506751',4*k);line(boardX+bw*.37,by-2,boardX+bw*.37,by+12*k,'#506751',4*k);
    [width*.26,width*.945].forEach(x=>{line(x,horizon+8,x,horizon-99*k,'#b7c4bc',3);ctx.fillStyle='#dee3d6';ctx.fillRect(x-17*k,horizon-104*k,34*k,11*k);});
    fence(g,horizon);
    // A couple of families watching from the grass outside the fence, over by
    // the clubrooms where everyone actually stands.
    for(let i=0;i<7;i++){const x=width*(i<4?.10+i*.055:.62+(i-4)*.06),y=horizon+14+(i%3)*4;
      ellipse(x,y-9*k,3*k,3*k,'#dbaf89');line(x,y-5*k,x,y+3*k,i%2?'#274c75':'#ddcbb1',5*k);}
    // The centre block: a straw prepared square with the playing strip down
    // the middle of it, which is how the square reads from the air.
    poly([[g.cx-27,g.far-17],[g.cx+27,g.far-17],[g.cx+g.spread*.90,g.near+36],[g.cx-g.spread*.90,g.near+36]],'#c6b583');
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
  // A right-handed striker seen from behind the stumps: the body stays
  // side-on and narrow, but the head is turned up the pitch to watch the
  // bowler, so the camera gets the back of the helmet and only a sliver of
  // cheek -- never a face looking out of the screen or off to the side.
  // Feet are separated up the pitch rather than across the screen, and both
  // legs share a hip line and bone lengths.
  function batter(x,y,h) {
    ctx.save();ctx.translate(x,y);ctx.scale(h/100,h/100);
    const t=s.swing?clamp(s.swing/.38,0,1):0;
    const step=Math.sin(t*Math.PI)*7;
    const hipY=-48;
    ellipse(2,1,19,5,'#28533340');
    // A pad is a narrow strip down the outside of the shin, built from the
    // knee and ankle so it follows the leg through the stride.
    const pad=(k,a,fill)=>{
      poly([[k.x-3.5,k.y-1],[k.x+3.5,k.y-2],[a.x+3.5,a.y-1],[a.x-3.5,a.y]],fill,'#bdc0af',1);
      [.34,.68].forEach(u=>line(mix(k.x,a.x,u)-3,mix(k.y,a.y,u)-1,mix(k.x,a.x,u)+3.5,mix(k.y,a.y,u)-2,'#c2beaa',1.4));
    };
    // Front leg: a stride up the pitch, so it sits a little higher and reads
    // slightly slimmer with distance. Both boots point to the off side.
    const fk={x:8+step*.5,y:-28-step*.5},fa={x:10+step,y:-7-step};
    line(3,hipY,fk.x,fk.y,'#d9dfd0',11);
    line(fk.x,fk.y,fa.x,fa.y,'#d9dfd0',10);
    line(fa.x-3,fa.y+2,fa.x+9,fa.y+1,'#17394d',6.5);
    pad(fk,fa,'#e9dfc2');
    // Back leg is the nearer one: same bones, planted behind the crease.
    const bk={x:-5,y:-25},ba={x:-1,y:1};
    line(-2,hipY,bk.x,bk.y,'#eef0e3',13);
    line(bk.x,bk.y,ba.x,ba.y,'#eef0e3',12);
    line(ba.x-4,ba.y+3,ba.x+10,ba.y+2,'#17394d',7);
    pad(bk,ba,'#f8efd5');
    // Profile torso: a narrow slab leaning over the front foot, with the near
    // shoulder rolled forward. The rear edge is shaded, not lettered.
    poly([[-6,-70],[1,-79],[10,-72],[11,-50],[-3,-47]],'#246bb4','#173b64',1.5);
    poly([[-6,-70],[0,-73],[2,-48],[-3,-47]],'#19528e');
    line(-2,-72,7,-75,'#a5d0ef',2.5);
    ctx.save();ctx.translate(1,-64);ctx.rotate(.07);text('7',0,0,7,'#c9e2f7');ctx.restore();
    // The head looks up the pitch at the bowler, so the camera sees the back
    // of the helmet: nape, shell and a cheek turned just past the shell edge.
    // The peak and grille are on the far side and read as slivers at most.
    line(0,-78,1,-85,'#d7a57c',7.5);
    ellipse(1,-94,12,12,'#164b83');
    ellipse(-2,-97,7.5,8.5,'#215c99');
    // Turning to watch the bowler carries the cheek just past the shell edge.
    ellipse(11.5,-91,3.5,4.5,'#d7a57c');
    poly([[8,-100],[16,-98],[15,-94],[9,-94]],'#103b67');
    line(11,-87,5,-85,'#103657',2.5);
    line(-6,-97,-2,-98,'#0f3860',2);line(-5,-92,-1,-93,'#0f3860',2);
    // The bat is a rigid length swung about the hands, so it never stretches
    // or collapses mid-stroke: the hands travel and the blade rotates.
    // Angles run clockwise from the off side, so +1.4 is grounded by the pad
    // and -1.0 is the raised backlift.
    const lift=s.phase==='delivery'&&!s.swing?clamp(s.time/s.flight,.0,1):0;
    const blade=46;
    let grip={x:15,y:-53},angle=mix(1.42,-1.0,lift);
    if(s.swing){
      const contactX=(s.line*geometry().spread*.38+17*geometry().scale)/(h/100);
      if(t<.32){const u=t/.32;grip={x:mix(15,contactX*.42,u),y:mix(-53,-46,u)};angle=mix(-1.0,.72,u);}
      else {const u=(t-.32)/.68;grip={x:mix(contactX*.42,s.side*20,u),y:mix(-46,-70,u)};angle=mix(.72,s.side>0?-1.3:-2.25,u);}
    }
    const toe={x:grip.x+Math.cos(angle)*blade,y:grip.y+Math.sin(angle)*blade};
    // Side-on means both arms hang on the off side of the body and the hands
    // stay together: the far arm is drawn first and a shade darker.
    // Elbows ride with the hands, so a raised follow-through never leaves a
    // sleeve hanging below the gloves.
    const elbowX=mix(11,grip.x*.55+7,t);
    const farY=mix(-65,(grip.y-73)/2,t),nearY=mix(-57,(grip.y-69)/2+4,t);
    line(3,-73,elbowX,farY,'#1f5f9f',8.5);
    line(elbowX,farY,grip.x+1,grip.y-3,'#cb9e78',5.5);
    line(7,-69,elbowX+2,nearY,'#2e7bc6',9.5);
    line(elbowX+2,nearY,grip.x-1,grip.y+3,'#d9aa82',6.5);
    const dx=toe.x-grip.x,dy=toe.y-grip.y;
    line(grip.x,grip.y,grip.x+dx*.32,grip.y+dy*.32,'#293f50',4);
    line(grip.x+dx*.32,grip.y+dy*.32,toe.x,toe.y,'#e8c789',9);
    line(grip.x+dx*.4-2,grip.y+dy*.4,toe.x-2,toe.y,'#fff0be',2);
    ellipse(grip.x-1,grip.y+3,4.5,4,'#fff5dc');ellipse(grip.x+1,grip.y-3,4.5,4,'#fff5dc');
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
    const batterX=g.cx-17*g.scale;
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
