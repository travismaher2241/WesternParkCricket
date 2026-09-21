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
  const BALL_SPREAD = .34;   // how far off the stumps a ball finishes
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
    s = {phase:'ready',runs:0,wickets:0,balls:0,history:[],practice,time:0,swing:0,swinging:false,side:0,fours:0,sixes:0,paused:false,debug:s?s.debug:false};
    overlay(null); feedback('READY, LIAM?', 'Watch the ball. Hit Left, Straight, or Right.'); hud();
    $('instruction').textContent = practice ? 'PRACTICE · HIT AS THE BALL REACHES THE BAT' : '12 BALLS · 3 WICKETS · LEFT, STRAIGHT, OR RIGHT';
  }
  function nextBall() {
    // Ease out of the last shot instead of snapping back to the stance.
    s.resetFrom = s.swinging ? swingPose(s.swing) : null;
    s.phase='runup'; s.time=0; s.swing=0; s.swinging=false; s.result=null; s.pending=null; s.contactAt=null;
    // A balanced shuffled bag avoids a long run of balls on just one side.
    if (!s.bag || !s.bag.length) {
      s.bag=[-1,-1,-1,1,1,1];
      for (let i=5;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}
    }
    // Mix attacking straight deliveries with balls outside the wicket.
    s.line=s.bag.pop()*(s.balls%3===2 ? .08+Math.random()*.02 : .72+Math.random()*.28);
    s.flight=rules.levels[difficulty].flight*(.94+Math.random()*.14);
    // Shorter leg-side balls suit a pull; fuller balls suit the drive.
    s.bounce=s.line<-.12 ? .56+Math.random()*.04 : .78+Math.random()*.04;
    feedback('', '');
    $('instruction').textContent = s.practice ? 'HIT AS THE BALL REACHES THE BAT.' : 'WATCH THE BALL. TRUST YOUR TIMING.';
  }
  function shot(side) {
    if(s.paused || s.phase!=='delivery' || s.pending) return;
    s.side=side; s.swing=SWING.contact; s.swinging=true;
    s.stroke=pickStroke(side);
    s.swingFrom=backliftPose(s.time);
    s.contactAt=s.time;
    s.pending=rules.judge(s.contactAt-s.flight,side,s.line,difficulty);
    if(!s.pending.missed) resolve(s.pending);
    const button=$(side<0?'left':side>0?'right':'straight');
    if(button){
      button.classList.add('pressed');
      setTimeout(()=>button.classList.remove('pressed'),140);
    }
  }
  function resolve(result) {
    s.hitOrigin=ballPosition(geometry());
    s.result=result; s.phase='result'; s.time=0;
    s.runs+=result.runs; s.wickets+=Number(result.wicket); s.balls++;
    s.history.push(result.wicket?'W':result.runs);
    if(result.runs===4)s.fours++; if(result.runs===6)s.sixes++;

    // Compute authentic stroke-driven ball launch physics
    const baseAngle = s.side < 0 ? -32 : s.side > 0 ? 32 : 0; // degrees (0=straight, negative=screen left, positive=screen right)
    const timingOffset = s.contactAt ? s.contactAt - s.flight : 0;
    let timingDrift = 0;
    if (timingOffset < -0.03) {
      timingDrift = Math.min(1, (-timingOffset - 0.03) / 0.12) * (s.side <= 0 ? 10 : -8);
    } else if (timingOffset > 0.03) {
      timingDrift = -Math.min(1, (timingOffset - 0.03) / 0.12) * (s.side >= 0 ? 10 : -8);
    }
    const launchAngle = baseAngle + timingDrift;
    const launchRad = launchAngle * Math.PI / 180;

    // The flight is shaped by the outcome, measured against the real rope:
    // a single is a push into the ring, a two runs into the gap, a four
    // beats the field to the boundary along the turf, and only a six leaves
    // the ground. Anything short of four stays down and pulls up short, so
    // the shot itself tells the player what it was worth.
    const dirX = Math.sin(launchRad), dirY = -Math.cos(launchRad);
    const rope = ropeDistance(boundary(geometry()), s.hitOrigin.x, s.hitOrigin.y, dirX, dirY);
    const reach = { 0: .26, 1: .46, 2: .74, 4: 1.06, 6: 1.5 }[result.runs];
    const airborne = result.runs === 6;
    const dist = rope * (reach === undefined ? .4 : reach);
    const duration = airborne ? 1.5 : result.runs >= 4 ? 1.35 : result.runs === 2 ? 1.15 : .95;

    s.ballFlight = {
      x0: s.hitOrigin.x,
      y0: s.hitOrigin.y,
      dirX, dirY,
      launchAngle,
      dist, rope, airborne, duration,
      // A skidded shot hops a couple of times and dies; a six climbs away.
      bounces: result.runs >= 4 ? 3 : 2,
      hop: airborne ? height * .42 : Math.min(30, height * .05) * (result.runs >= 4 ? 1 : .7),
      speed: dist / duration,
      runs: result.runs
    };

    s.lastDebug = {
      shot: s.stroke ? s.stroke.toUpperCase() : 'STRAIGHT',
      sideName: s.side < 0 ? 'LEFT (LEG SIDE)' : s.side > 0 ? 'RIGHT (OFF SIDE)' : 'STRAIGHT (DOWN GROUND)',
      timing: result.timing || (result.missed ? 'MISSED' : 'TIMED'),
      contactPoint: { x: Math.round(s.hitOrigin.x), y: Math.round(s.hitOrigin.y) },
      launchAngle: (launchAngle >= 0 ? '+' : '') + launchAngle.toFixed(1) + '°',
      launchVelocity: Math.round(s.ballFlight.speed) + ' px/s',
      runs: result.runs,
      wicket: result.wicket
    };

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
    $('resultMessage').textContent=`${s.balls} balls faced at Western Park Oval. `+(s.runs<16?'Wait for the bounce, then time your swing.':'The Warriors will take that!');
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
  const straightBtn=$('straight');
  if(straightBtn){straightBtn.addEventListener('pointerdown',e=>{e.preventDefault();shot(0);});straightBtn.onclick=e=>{if(e.detail===0)shot(0);};}
  // Keyboard activation of the on-screen controls remains accessible.
  $('left').onclick=e=>{if(e.detail===0)shot(-1);};$('right').onclick=e=>{if(e.detail===0)shot(1);};
  addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(e.key==='Escape'){pause();return;}
    if(e.key==='`'||e.key==='~'){s.debug=!s.debug;return;}
    const key=e.key.toLowerCase();
    if(['arrowleft','a'].includes(key)&&!['menu','finished'].includes(s.phase)){
      e.preventDefault();shot(-1);
    }else if(['arrowright','d'].includes(key)&&!['menu','finished'].includes(s.phase)){
      e.preventDefault();shot(1);
    }else if(['arrowup','w',' ','arrowdown','s'].includes(key)&&!['menu','finished'].includes(s.phase)){
      e.preventDefault();shot(0);
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!s.paused&&!['menu','finished'].includes(s.phase))pause();});
  function update(dt) {
    if(s.paused || ['menu','finished'].includes(s.phase))return;
    s.time+=dt;if(s.swinging)s.swing+=dt;
    if(s.phase==='ready'&&s.time>1.65)nextBall();
    else if(s.phase==='runup'&&s.time>1.05){s.phase='delivery';s.time=0;}
    else if(s.phase==='delivery') {
      if(s.pending){
        const at=s.pending.missed?s.flight+.20:s.contactAt;
        if(s.time>=at)resolve(s.pending);
      }
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
  // The rope as an ellipse. The ball's flight is measured against the same
  // numbers the fence is drawn from, so a four reaches the boundary the
  // player can see rather than an invented one.
  function boundary(g) {
    const horizon=height*(height<500?.38:.31),top=horizon+16,bottom=height*1.13;
    return {cx:g.cx,cy:(top+bottom)/2,rx:width*.61,ry:(bottom-top)/2,top};
  }
  // How far a shot leaving (x,y) along (dx,dy) travels before it crosses the
  // rope, in screen pixels.
  function ropeDistance(b,x,y,dx,dy) {
    const px=(x-b.cx)/b.rx,py=(y-b.cy)/b.ry,ux=dx/b.rx,uy=dy/b.ry;
    const A=ux*ux+uy*uy,B=2*(px*ux+py*uy),C=px*px+py*py-1,disc=B*B-4*A*C;
    if(A===0||disc<=0)return height*.8;
    return clamp((-B+Math.sqrt(disc))/(2*A),60,height*1.6);
  }
  function fence(g) {
    const b=boundary(g);
    ctx.strokeStyle='#cbcabc';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(b.cx,b.cy,b.rx+14,b.ry+12,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f4efdd';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(b.cx,b.cy,b.rx,b.ry,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<=64;i++){const a=Math.PI+Math.PI*i/64,x=b.cx+Math.cos(a)*b.rx,y=b.cy+Math.sin(a)*b.ry;
      if(y>height)continue;
      const h=mix(6,17,clamp((y-b.top)/(height*.62-b.top),0,1));line(x,y-h*.35,x,y+h*.65,'#f7f2e2',2.4);}
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
    text('WESTERN PARK OVAL',boardX,by-bh*.68,7*k,'#c7d9b8');text(`${s.runs} / ${s.wickets}`,boardX,by-bh*.2,16*k,'#ffdf77');
    line(boardX-bw*.37,by-2,boardX-bw*.37,by+12*k,'#506751',4*k);line(boardX+bw*.37,by-2,boardX+bw*.37,by+12*k,'#506751',4*k);
    [width*.26,width*.945].forEach(x=>{line(x,horizon+8,x,horizon-99*k,'#b7c4bc',3);ctx.fillStyle='#dee3d6';ctx.fillRect(x-17*k,horizon-104*k,34*k,11*k);});
    fence(g);
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
    if(s.practice){const y=g.near-22*g.scale;line(g.cx-g.spread*.7,y,g.cx+g.spread*.7,y,'#ffd25c',2);}
  }
  function stumps(x,y,h,broken){for(let i=-1;i<=1;i++)line(x+i*h*.15,y,x+i*h*.15+(broken?i*h*.7:0),y-h,'#f8ecce',Math.max(2,h*.075));if(!broken)line(x-h*.21,y-h,x+h*.21,y-h,'#fff5d7',Math.max(2,h*.06));else{line(x-h*.8,y-h*1.2,x-h*.4,y-h*1.3,'#fff5d7',3);}}
  // ------------------------------------------------------------- batting
  // A cricket shot is a rigid bat swung on an arc. Every pose below is a bat
  // ANGLE plus where the top hand is, so the blade keeps its length and the
  // toe sweeps a real arc instead of stretching between drawn positions.
  // Angles are degrees: 0 hangs straight down, positive swings the toe to the
  // off side.
  const BAT_LEN = 43;
  // How far his head turns up the pitch to watch the bowler, in degrees.
  // Three quarters rather than square on: the helmet art is drawn in profile,
  // so turning it all the way to the bowler makes him look at the sky.
  const EYELINE = -36;
  const pose = (ang,hx,hy,tilt,step,head,hip,heel) => ({ang,hx,hy,tilt,step,head,hip,heel});
  const STANCE    = pose(   4, 10, -41,  0,  0,  0,   0, 0);
  const BACKLIFT  = pose(-152,  6, -53, -2,  0, -1,  -4, 0);
  const CELEBRATE = pose(-146, -8, -66, -6,  2, -5,   0, 0);
  const SLUMP     = pose(  26, 12, -34, 10,  0,  8,   0, 0);

  // Authentic Cricket Stroke Families:
  // LEFT: right-handed leg glance / pull.
  // STRAIGHT: Pure Straight Drive (clean vertical blade driving down the pitch past the bowler)
  // RIGHT: right-handed cover drive / cut.
  const STROKES = {
    coverDrive: { contact: pose( 22, 20, -46, 6, 11,  5,  2, 2),
                  extend:  pose( 60, 21, -52, 7, 11,  4,  5, 3),
                  finish:  pose(126, 12, -60, 7, 11,  1,  8, 5) },
    cut:        { contact: pose( 72, 15, -49, 2,  1,  2, -8, 5),
                  extend:  pose(104, 11, -56, 3,  1,  1,-12, 6),
                  finish:  pose(148,  4, -60, 4,  0, -1,-14, 8) },
    straight:   { contact: pose( 12, 19, -47, 4, 11,  4,  2, 2),
                  extend:  pose( 48, 19, -53, 5, 11,  3,  4, 3),
                  finish:  pose(112, 14, -62, 5, 11,  1,  6, 5) },
    flick:      { contact: pose( 14, 17, -44, 3,  6,  3,  8, 2),
                  extend:  pose(-55, 13, -50, 4,  6,  2, 14, 4),
                  finish:  pose(-135, 3, -58, 5,  5,  0, 20, 6) },
    pull:       { contact: pose( 20, 14, -46, 2, -1,  2, 12, 4),
                  extend:  pose(-65, 10, -52, 3, -1,  1, 18, 6),
                  finish:  pose(-145, 2, -58, 4, -2, -1, 24, 8) }
  };
  // Aliases for compatibility
  STROKES.left = STROKES.flick;
  STROKES.right = STROKES.coverDrive;
  STROKES.drive = STROKES.coverDrive;

  // Sprite animation timestamps. Input starts at contact, with no scoring delay.
  const CONTACT_LEAD = .16;
  const SWING = { back: .06, contact: CONTACT_LEAD, extend: .24, finish: .46, rest: .92 };

  const easeIn = u => u*u;
  const easeOut = u => 1-(1-u)*(1-u);
  const easeInOut = u => u<.5 ? 2*u*u : 1-Math.pow(-2*u+2,2)/2;
  const smooth = u => u*u*(3-2*u);

  // Shift by whole turns so it is the nearest equivalent angle.
  function nearAngle(from,to){ let d=(to-from)%360; if(d>180)d-=360; if(d<-180)d+=360; return from+d; }
  function lerpPose(a,b,t){
    return pose(mix(a.ang,b.ang,t),mix(a.hx,b.hx,t),mix(a.hy,b.hy,t),mix(a.tilt,b.tilt,t),
      mix(a.step,b.step,t),mix(a.head,b.head,t),mix(a.hip,b.hip,t),mix(a.heel,b.heel,t));
  }
  // The backlift is picked up as the bowler releases, not snapped into place.
  function liftAt(time){ return clamp((time-.05)/Math.max(.2,(s.flight||1)*.72),0,1); }
  function backliftPose(time){ return lerpPose(STANCE,BACKLIFT,smooth(liftAt(time))); }
  // Lateral line reach only: subtle hand adjustment for lateral ball line without angular distortion.
  function reachAt(t){
    if (t < SWING.back || t > SWING.finish) return 0;
    const u = t < SWING.contact ? (t-SWING.back)/(SWING.contact-SWING.back)
                                : 1-(t-SWING.contact)/(SWING.finish-SWING.contact);
    return clamp((s.line||0)*4,-4,4)*clamp(u,0,1);
  }
  function ballAtContact(){
    const g=geometry(), bh=clamp(136*g.scale,87,150), unit=bh/100;
    const rise=Math.pow(1-s.bounce,2)*340*g.scale;
    return { x:((s.line*g.spread*BALL_SPREAD)+20*g.scale)/unit, y:(3-rise*.624)/unit };
  }

  function pickStroke(side){
    const shortBall = s.bounce < .62;
    if (side === 0) return 'straight';
    if (side < 0) return shortBall ? 'pull' : 'flick';
    return shortBall ? 'cut' : 'coverDrive';
  }

  /* The swing itself. Accelerating down into the ball, a short drive through
     the line, a decelerating follow-through, then a relaxed recovery. */
  function swingPose(t){
    const p = swingShape(t);
    p.hx += reachAt(t);
    return p;
  }
  function swingShape(t){
    const k = STROKES[s.stroke] || STROKES.straight;
    const from = s.swingFrom || BACKLIFT;
    if (t < SWING.back)    return lerpPose(from, BACKLIFT, easeOut(t/SWING.back));
    if (t < SWING.contact) {
      const u = easeIn((t-SWING.back)/(SWING.contact-SWING.back));
      return lerpPose(BACKLIFT, k.contact, u);
    }
    if (t < SWING.extend) {
      const u = (t-SWING.contact)/(SWING.extend-SWING.contact);
      return lerpPose(k.contact, k.extend, u);
    }
    if (t < SWING.finish) {
      const u = easeOut((t-SWING.extend)/(SWING.finish-SWING.extend));
      return lerpPose(k.extend, k.finish, u);
    }
    const done = s.result || s.pending || {};
    const target = done.runs >= 4 ? CELEBRATE : done.wicket ? SLUMP : STANCE;
    const settle = pose(nearAngle(k.finish.ang,target.ang),target.hx,target.hy,target.tilt,target.step,target.head,target.hip,target.heel);
    return lerpPose(k.finish, settle, easeInOut(clamp((t-SWING.finish)/(SWING.rest-SWING.finish),0,1)));
  }

  // Authored right-handed sprites. NEVER mirror this atlas: both shot sides
  // have their own poses so handedness, helmet and grip remain consistent.
  const battingSheet = new Image();
  let battingReady = false;
  ['play','practice'].forEach(id => $(id).disabled = true);
  battingSheet.onload = () => {
    buildLegSide();
    battingReady = true;
    ['play','practice'].forEach(id => $(id).disabled = false);
  };
  battingSheet.onerror = () => {
    document.querySelector('.menu-note').textContent = 'Batting artwork could not load. Please refresh the game.';
  };
  battingSheet.src = 'assets/liam-batting-right.png';
  // ------------------------------------------------------------ leg side
  // The atlas's own leg-side frames are wrong. Frame 4 has his head turned
  // round to square leg before the ball is hit, and frame 5 is a front-foot
  // drive finish. Until authored frames replace them, a pull is built from
  // the art that is right: frame 4's opened-up body and bat (the hips and
  // shoulders really do open on a pull) with frame 6's head, which is still
  // watching the ball. The follow-through carries that bat up and round.
  // Coordinates are in atlas-cell pixels.
  const CELL_W = 384, CELL_H = 512;
  const LEG_CONTACT = 8, LEG_FOLLOW = 9;
  const LEFT_GRILLE = [[150,96],[187,96],[187,114],[186,126],[192,134],[192,150],[150,150]];
  const HEAD_DONOR  = [[150,96],[155,80],[168,67],[192,61],[214,65],[229,79],[233,96],
                       [235,108],[233,120],[225,128],[214,134],[200,137],[186,133],
                       [170,129],[161,122],[156,110]];
  const HEAD_DX = 11, HEAD_DY = 6;          // frame 6 head onto frame 4's neck
  const BLADE = [[18,222],[18,256],[64,256],[141,224],[141,196],[96,196]];
  const GRIP = [148,208], WRAP = 62;        // pivot at the bottom hand, degrees
  let legContact = null, legFollow = null;

  function cellCanvas(frame){
    const c = document.createElement('canvas'); c.width = CELL_W; c.height = CELL_H;
    if (frame != null) c.getContext('2d').drawImage(battingSheet,(frame%4)*CELL_W,Math.floor(frame/4)*CELL_H,
      CELL_W,CELL_H,0,0,CELL_W,CELL_H);
    return c;
  }
  function within(c2, pts, fn){
    c2.save(); c2.beginPath();
    pts.forEach((p,i)=>i?c2.lineTo(p[0],p[1]):c2.moveTo(p[0],p[1]));
    c2.closePath(); c2.clip(); fn(); c2.restore();
  }
  function buildLegSide(){
    // Contact: frame 4 without its left-facing grille, wearing frame 6's head.
    const contact = cellCanvas(4), cc = contact.getContext('2d');
    within(cc, LEFT_GRILLE, () => cc.clearRect(0,0,CELL_W,CELL_H));
    const donor = cellCanvas(6);
    within(cc, HEAD_DONOR.map(([x,y])=>[x+HEAD_DX,y+HEAD_DY]), () => cc.drawImage(donor,HEAD_DX,HEAD_DY));
    legContact = contact;

    // Follow-through: lift the blade off, wrap it up and round about the
    // bottom hand, then lay the body back over it so the gloves hold it.
    const blade = cellCanvas(null), bc = blade.getContext('2d');
    within(bc, BLADE, () => bc.drawImage(contact,0,0));
    const body = cellCanvas(null), yc = body.getContext('2d');
    yc.drawImage(contact,0,0);
    within(yc, BLADE, () => yc.clearRect(0,0,CELL_W,CELL_H));
    const follow = cellCanvas(null), fc = follow.getContext('2d');
    fc.save(); fc.translate(GRIP[0],GRIP[1]); fc.rotate(WRAP*Math.PI/180); fc.translate(-GRIP[0],-GRIP[1]);
    fc.drawImage(blade,0,0); fc.restore();
    fc.drawImage(body,0,0);
    legFollow = follow;
  }

  function battingFrame() {
    if (!s.swinging) return s.phase === 'delivery' && liftAt(s.time) > .35 ? 1 : 0;
    const t = s.swing;
    if (t < SWING.contact-.035) return 1;
    const leg = s.side < 0;
    const contact = leg ? LEG_CONTACT : s.side > 0 ? 2 : 6;
    if (t < SWING.extend+.035) return contact;
    if (t < SWING.rest) return leg ? LEG_FOLLOW : contact+1;
    return 0;
  }
  function batter(x,y,h) {
    if (!battingReady) return;
    const frame = battingFrame(), cellW = 384, cellH = 512;
    const unit = h/410;
    // The atlas uses the same camera and physical scale in every cell.
    // Align the grounded back foot; no negative scale or helmet rotations.
    ellipse(x,y+2,22*unit*3,5*unit*3,'#28533340');
    const built = frame === LEG_CONTACT ? legContact : frame === LEG_FOLLOW ? legFollow : null;
    if (built) {
      // Built from frame 4, so it keeps frame 4's foot alignment.
      ctx.drawImage(built,0,0,cellW,cellH,x-180*unit,y-470*unit,cellW*unit,cellH*unit);
      return;
    }
    ctx.drawImage(battingSheet,(frame%4)*cellW,Math.floor(frame/4)*cellH,
      cellW,cellH,x-(frame===6||frame===7?220:180)*unit,y-470*unit,cellW*unit,cellH*unit);
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
    const b=window.CricketDelivery.sample(s.time,s.flight,s.bounce);
    const t=b.progress;
    const groundY=mix(g.far,g.near-22*g.scale,t);
    const x=mix(g.cx+20*g.scale,g.cx+s.line*g.spread*BALL_SPREAD,t);
    const pixelsPerMetre=mix(40,70,t)*g.scale;
    return {x,y:groundY-b.height*pixelsPerMetre,groundY,
      r:mix(3,7,clamp(t,0,1))*Math.max(.7,g.scale)};
  }
  const bowlingSheet=new Image();
  bowlingSheet.src='assets/bowler-action.png';
  function bowler(g) {
    if(!bowlingSheet.complete || !bowlingSheet.naturalWidth)return;
    let frame=7, advance=0;
    if(s.phase==='runup') {
      const t=s.time;
      frame=t<.65?Math.floor(t/.13)%2:t<.83?2:3;
      advance=-38*g.scale*(1-clamp(t/1.05,0,1));
    } else if(s.phase==='delivery') {
      frame=s.time<.09?4:s.time<.23?5:s.time<.43?6:7;
      advance=Math.min(s.time,.55)*15*g.scale;
    }
    const unit=70*g.scale/400;
    const cellW=bowlingSheet.naturalWidth/4,cellH=bowlingSheet.naturalHeight/2;
    ctx.drawImage(bowlingSheet,(frame%4)*cellW,Math.floor(frame/4)*cellH,cellW,cellH,
      g.cx+30*g.scale-250*unit,g.far+advance-470*unit,384*unit,512*unit);
  }
  function drawBall(x,y,r,shadowY){
    ellipse(x,shadowY,r*1.3,r*.35,'#244b3b40');ellipse(x,y,r+2,r+2,'#fff5d4');ellipse(x,y,r,r,'#bc382e');line(x-r*.35,y-r*.7,x+r*.3,y+r*.7,'#ffe0b4',Math.max(1,r*.2));
  }
  function draw() {
    ctx.clearRect(0,0,width,height);const g=geometry();ground(g);
    // Fielders stay in the shot; runs are resolved quickly for arcade pacing.
    const spots=[[.14,.53],[.29,.43],[.74,.44],[.89,.56],[.08,.76],[.93,.77]];
    // When the ball pulls up inside the ring, the nearest fielder runs it
    // down, so it is clear why it stopped there rather than reaching the rope.
    let chase=-1,rest=null;
    if(s.phase==='result'&&s.ballFlight&&!s.result.wicket&&!s.result.missed&&s.result.runs<4){
      const bf=s.ballFlight;
      rest={x:bf.x0+bf.dirX*bf.dist,y:bf.y0+bf.dirY*bf.dist};
      let best=Infinity;
      spots.forEach(([x,y],i)=>{const d=Math.hypot(width*x-rest.x,height*y-rest.y);if(d<best){best=d;chase=i;}});
    }
    spots.forEach(([x,y],i)=>{
      let px=width*x,py=height*y;
      if(i===chase){const u=clamp((s.time-.2)/.95,0,1);px=mix(px,rest.x,u);py=mix(py,rest.y+7*g.scale,u);}
      else if(s.phase==='result'&&s.result.runs>0&&Math.sign(px-g.cx)===s.side){px+=s.side*Math.min(s.time,1)*32;py+=Math.sin(i)*s.time*8;}
      person(px,py,48*g.scale,'fielder',s.phase==='result'?s.time*12:0);
    });
    // The bowler's-end umpire looks straight down the pitch from behind the wicket.
    person(g.cx,g.far-28*g.scale,60*g.scale,'umpire');
    stumps(g.cx,g.far+3,23*g.scale,false);
    person(g.cx-48*g.scale,g.far+10,62*g.scale,'partner');
    person(g.cx-Math.min(width*.39,360),g.near-3,65*g.scale,'umpire');
    bowler(g);
    const bh=clamp(150*g.scale,100,175);
    const batterX=g.cx-14*g.scale;
    // Smaller screen Y is up the pitch: Liam stands at the popping crease,
    // ahead of his wicket. Draw the nearer stumps last for correct overlap.
    batter(batterX,g.near-3,bh);
    stumps(g.cx,g.near+28*g.scale,48*g.scale,s.phase==='result'&&s.result.wicket);
    if(s.phase==='delivery'){
      const b=ballPosition(g);drawBall(b.x,b.y,b.r,b.groundY);
      if(s.practice){const t=clamp(s.time/s.flight,0,1);ctx.globalAlpha=.8;line(g.cx-45,g.near+40,g.cx+45,g.near+40,'#173b38',5);line(g.cx-45,g.near+40,g.cx-45+90*t,g.near+40,'#ffdc6d',5);ctx.globalAlpha=1;}
    }
    if(s.phase==='result'&&!s.result.wicket&&!s.result.missed&&s.ballFlight){
      const bf=s.ballFlight,t=clamp(s.time/bf.duration,0,1);
      // A ball hit along the turf loses pace to the outfield and pulls up;
      // a six holds its speed until it is out of the ground.
      const travel=bf.airborne?t:1-(1-t)*(1-t);
      const gx=bf.x0+bf.dirX*bf.dist*travel,gy=bf.y0+bf.dirY*bf.dist*travel;
      // Height off the turf: decaying hops for a skidded shot, one long
      // climb for a six.
      // A six climbs steadily rather than leaping, so the player watches it
      // clear the rope instead of losing it in the first few frames.
      const hop=bf.airborne?Math.sin(t*.9*Math.PI)*bf.hop
        :Math.abs(Math.sin(t*Math.PI*bf.bounces))*bf.hop*Math.pow(1-t,1.6);
      const r=Math.max(2.4,7*clamp(1-travel*(bf.airborne?.7:.5),.3,1));
      // A grounded ball stays where it stopped; a six is followed until it
      // leaves the top of the frame, and its shadow goes with it.
      if((t<1||!bf.airborne)&&gy-hop>-r){
        if(hop>2)line(gx-bf.dirX*9,gy-bf.dirY*9-hop*.85,gx,gy-hop,'#fff7d59c',2.4);
        drawBall(gx,gy-hop,r,gy);
      }
    }
    if(s.phase==='result'&&s.result.runs>=4){
      for(let i=0;i<32;i++){const t=s.time,x=width*((i*.618)%1),y=height*.12+t*(55+i%7*16);ctx.save();ctx.translate(x+Math.sin(i+t*3)*15,y);ctx.rotate(i+t*2);ctx.fillStyle=i%2?'#ffcf56':'#f4edcf';ctx.fillRect(-3,-2,6,4);ctx.restore();}
    }
    if(s.debug){
      // Debug Vector Arrow from contact point
      if(s.ballFlight){
        const bf=s.ballFlight, vLen=85;
        const rad=bf.launchAngle*Math.PI/180;
        const endX=bf.x0+Math.sin(rad)*vLen, endY=bf.y0-Math.cos(rad)*vLen;
        line(bf.x0,bf.y0,endX,endY,'#00ffcc',3);
        ellipse(bf.x0,bf.y0,4,4,'#ff0055');
        // Arrowhead
        line(endX,endY,endX-Math.sin(rad+.45)*10,endY+Math.cos(rad+.45)*10,'#00ffcc',3);
        line(endX,endY,endX-Math.sin(rad-.45)*10,endY+Math.cos(rad-.45)*10,'#00ffcc',3);
      }
      // Debug HUD Panel
      ctx.save();
      const hudW=260, hudH=124;
      const hudX=width-hudW-16, hudY=102;
      ctx.fillStyle='rgba(12,24,34,0.92)';
      ctx.fillRect(hudX,hudY,hudW,hudH);
      ctx.strokeStyle='#00ffcc';ctx.lineWidth=1.5;
      ctx.strokeRect(hudX,hudY,hudW,hudH);
      ctx.font='bold 11px monospace';ctx.textAlign='left';
      ctx.fillStyle='#00ffcc';
      ctx.fillText('DEBUG MODE [Toggle: ` or ~]',hudX+10,hudY+18);
      const dbg=s.lastDebug||{};
      ctx.fillStyle='#ffffff';
      ctx.fillText(`SHOT:    ${dbg.shot||(s.stroke?s.stroke.toUpperCase():'NONE')}`,hudX+10,hudY+38);
      ctx.fillText(`TIMING:  ${dbg.timing||'WAITING'}`,hudX+10,hudY+56);
      ctx.fillText(`CONTACT: ${dbg.contactPoint?`${dbg.contactPoint.x}, ${dbg.contactPoint.y}`:'N/A'}`,hudX+10,hudY+74);
      ctx.fillText(`LAUNCH:  ${dbg.launchAngle||'0°'} @ ${dbg.launchVelocity||'0 px/s'}`,hudX+10,hudY+92);
      ctx.fillText(`RESULT:  ${dbg.runs!==undefined?`${dbg.runs} RUNS`+(dbg.wicket?' (W)':' '):'READY'}`,hudX+10,hudY+110);
      ctx.restore();
    }
  }
  function frame(now) {const dt=last?Math.min((now-last)/1000,.05):0;last=now;update(dt);draw();requestAnimationFrame(frame);}
  // Development hook. Lets the browser checks drive a delivery and inspect a
  // swing frame by frame instead of waiting on real time.
  window.BoundaryBashDebug={state:()=>s,geometry,ballPosition,pickStroke,swingPose,backliftPose,shot,SWING,STROKES,ballAtContact,battingFrame,battingReady:()=>battingReady,legFrames:()=>({legContact,legFollow,LEG_CONTACT,LEG_FOLLOW}),toggleDebug:()=>{s.debug=!s.debug;}};
  hud();overlay('menu');requestAnimationFrame(frame);
})();
