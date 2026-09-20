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
    $('instruction').textContent = practice ? 'PRACTICE · HIT AT THE GOLD CREASE' : '12 BALLS · 3 WICKETS · LEFT, STRAIGHT, OR RIGHT';
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
    s.bounce=.52+Math.random()*.20;
    feedback('', '');
    $('instruction').textContent = s.practice ? 'WATCH IT BOUNCE. HIT AT THE GOLD LINE.' : 'WATCH THE BALL. TRUST YOUR TIMING.';
  }
  function shot(side) {
    if(s.paused || s.phase!=='delivery' || s.pending) return;
    s.side=side; s.swing=0; s.swinging=true;
    s.stroke=pickStroke(side);
    s.swingFrom=backliftPose(s.time);
    s.contactAt=s.time+CONTACT_LEAD;
    s.pending=rules.judge(s.contactAt-s.flight,side,s.line,difficulty);
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

    // Power & velocity from timing quality and outcome
    let speed = 0;
    if (!result.missed && !result.wicket) {
      if (result.runs === 6) speed = width * 0.72;
      else if (result.runs === 4) speed = width * 0.58;
      else if (result.runs === 2) speed = width * 0.38;
      else if (result.runs === 1) speed = width * 0.28;
      else speed = width * 0.18;
    }

    const vx = Math.sin(launchRad) * speed;
    const vy = -Math.cos(launchRad) * speed;
    const maxHeight = result.runs === 6 ? height * 0.65 : result.runs === 4 ? height * 0.12 : height * 0.07;
    const duration = result.runs >= 4 ? 1.3 : 1.0;

    s.ballFlight = {
      x0: s.hitOrigin.x,
      y0: s.hitOrigin.y,
      groundY0: s.hitOrigin.groundY,
      vx,
      vy,
      launchAngle,
      speed,
      maxHeight,
      duration,
      runs: result.runs
    };

    s.lastDebug = {
      shot: s.stroke ? s.stroke.toUpperCase() : 'STRAIGHT',
      sideName: s.side < 0 ? 'LEFT (OFF-SIDE)' : s.side > 0 ? 'RIGHT (ON-SIDE)' : 'STRAIGHT (DOWN GROUND)',
      timing: result.timing || (result.missed ? 'MISSED' : 'TIMED'),
      contactPoint: { x: Math.round(s.hitOrigin.x), y: Math.round(s.hitOrigin.y) },
      launchAngle: (launchAngle >= 0 ? '+' : '') + launchAngle.toFixed(1) + '°',
      launchVelocity: Math.round(speed) + ' px/s',
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

  // Three authentic shot families:
  // Left: Off-side cover drive / punch (blade sweeps out to screen left)
  // Straight: Clean straight drive (blade swings down vertical plane past bowler)
  // Right: On-drive / leg-side flick (hips rotate, blade rolls to screen right)
  const STROKES = {
    left:     { contact: pose(-26, 18, -44, 4, 10, 4,  3, 2),
                extend:  pose(-66, 15, -50, 6, 10, 2,  6, 3),
                finish:  pose(-115, 8, -58, 7, 10, 0, 10, 5) },
    straight: { contact: pose( -2, 19, -46, 5, 11, 4,  2, 2),
                extend:  pose(  8, 19, -52, 6, 11, 3,  5, 3),
                finish:  pose( 35, 13, -60, 6, 11, 1,  8, 5) },
    right:    { contact: pose( 28, 17, -44, 3,  6, 3,  6, 2),
                extend:  pose( 68, 13, -50, 5,  6, 2, 12, 4),
                finish:  pose(135,  4, -58, 6,  5, 0, 18, 6) }
  };
  STROKES.pull = STROKES.left;
  STROKES.cut = STROKES.left;
  STROKES.drive = STROKES.straight;
  STROKES.flick = STROKES.right;

  // Press to contact. A perfectly timed press puts the bat on the ball at the
  // moment it reaches the crease, which is why the delivery resolves here too.
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
    if (side === 0) return 'straight';
    return side < 0 ? 'left' : 'right';
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

  // An authentic side-on cricket batsman holding the bat with normal hands.
  // Profile faces down the pitch with an athletic forward lean over the popping
  // crease, white batting pads, helmet peak focused on the bowler, and gloved
  // hands gripping the handle.
  function batter(x,y,h) {
    ctx.save();ctx.translate(x,y);ctx.scale(h/100,h/100);

    const isDelivery = s.phase==='delivery';
    const isResult = s.phase==='result';
    const swingT = s.swinging ? s.swing : -1;

    let p;
    if (s.swinging) p = swingPose(swingT);
    else if (isDelivery) p = backliftPose(s.time);
    else if (isResult && s.result && s.result.wicket) p = lerpPose(STANCE,SLUMP,smooth(clamp(s.time/.5,0,1)));
    else if (s.phase==='runup' && s.resetFrom) p = lerpPose(s.resetFrom,STANCE,smooth(clamp(s.time/.42,0,1)));
    else { p = lerpPose(STANCE,STANCE,0); p.hy += Math.sin(s.time*7)>.25 ? -2.5 : 0; }

    const lookBack = isResult && s.result && s.result.wicket && s.time > .28;
    const bodyTilt = p.tilt, frontStep = p.step, headDrop = p.head, hipTurn = p.hip, heel = p.heel;

    const ang = p.ang*Math.PI/180;
    const ux = Math.sin(ang), uy = Math.cos(ang);
    const nx = -uy, ny = ux;
    const grip = {x:p.hx, y:p.hy};
    const toe = {x:p.hx+ux*BAT_LEN, y:p.hy+uy*BAT_LEN};

    // Shadow on turf
    ellipse(-2+frontStep*.45,3,21,5.6,'#28533340');
    if(toe.y>-4)ellipse(toe.x,toe.y+1,7,2.5,'#28533330');

    const inContact = s.swinging && swingT >= SWING.contact-.01 && swingT <= SWING.extend+.04;
    const batBehind = !inContact && uy < .12;
    if (batBehind) paintBat();

    // Joint anchors
    const shoulderLift = headDrop*.4;
    const sxFar=9+bodyTilt+hipTurn*.30, syFar=-74+shoulderLift;
    const sxNear=3+bodyTilt+hipTurn*.30, syNear=-73+shoulderLift;
    const topGrip={x:grip.x-ux*6,y:grip.y-uy*6};
    const botGrip={x:grip.x,y:grip.y};
    const farElbow={x:mix(sxFar,topGrip.x,.45)+6,y:mix(syFar,topGrip.y,.5)+3};
    const nearElbow={x:mix(sxNear,botGrip.x,.45)+4,y:mix(syNear,botGrip.y,.5)+4};

    // 1. Far (Front) Leg. Side on, this leg is directly behind the back one,
    //    so in the stance it is hidden and only a sliver of it shows. It comes
    //    out from behind the body when he strides into a shot.
    const fKneeX=-2+frontStep*.75,fKneeY=-28;
    const fFootX=-4+frontStep*1.2,fFootY=-1;
    line(-1+bodyTilt,-47,fKneeX,fKneeY,'#1c5aa8',11);
    poly([[fKneeX-4,fKneeY-5],[fKneeX+5,fKneeY-3],[fFootX+5,fFootY-3],[fFootX-4,fFootY-3]],'#f4f5ee','#b8beaf',1.2);
    line(fKneeX-3,fKneeY,fKneeX+4,fKneeY,'#ccd1c2',2.2);
    line(fKneeX-3,fKneeY+7,fFootX-3,fFootY-4,'#d8ddd0',1.5);
    line(fKneeX+1,fKneeY+7,fFootX+1,fFootY-4,'#d8ddd0',1.5);
    line(fKneeX-4,fKneeY+4,fKneeX-2,fKneeY+4,'#8a948c',2);
    line(fFootX-4,fFootY-7,fFootX-2,fFootY-7,'#8a948c',2);
    poly([[fFootX-4,fFootY-2],[fFootX+8,fFootY-2],[fFootX+10,fFootY+1],[fFootX-5,fFootY+1]],'#ffffff','#ccd1c2',1);
    line(fFootX-5,fFootY+1.5,fFootX+10,fFootY+1.5,'#293f50',2);

    // 2. Near (Back) Leg - the one you actually see. It rocks back and up onto
    //    the toe for a shot off the back foot.
    const bKneeX=-5-hipTurn*.10-heel*.55,bKneeY=-27-heel*.45;
    const bFootX=-6-hipTurn*.06-heel*.85,bFootY=-heel*.55;
    line(-4+bodyTilt,-47,bKneeX,bKneeY,'#164887',11);
    poly([[bKneeX-4,bKneeY-5],[bKneeX+4,bKneeY-3],[bFootX+4,bFootY-3],[bFootX-4,bFootY-3]],'#ecefe5','#b2b8a8',1.2);
    line(bKneeX-3,bKneeY,bKneeX+3,bKneeY,'#c4cab9',2);
    poly([[bFootX-4,bFootY-2],[bFootX+7,bFootY-2],[bFootX+9,bFootY+1],[bFootX-5,bFootY+1]],'#ffffff','#ccd1c2',1);
    line(bFootX-5,bFootY+1.5,bFootX+9,bFootY+1.5,'#293f50',2);

    // 3. Side-on Torso leaning forward
    const hx=-3+bodyTilt+hipTurn*.16,hy=-47;
    poly([[hx-4,hy],[hx+6,hy],[sxFar+3,syFar],[sxNear-3,syNear],[hx-4,hy]],'#1c5fa8','#113c6b',1.2);
    poly([[hx-4,hy],[hx,hy],[sxNear-1,syNear],[sxNear-3,syNear]],'#13467e');
    line(hx+1,hy,sxNear+1,syNear,'#ffd25c',2);

    // 4. Head, Neck & Helmet. The bowler is up the pitch, not square, so the
    //    helmet turns to face him and then follows the ball down as Liam
    //    plays: the same number that drops his head into the shot swings his
    //    eyeline from up the pitch to down at the ball and back up after it.
    const neckX=7+bodyTilt*.6+hipTurn*.18,neckY=-76+headDrop*.4;
    const headX=(lookBack?3:11)+bodyTilt*.7+hipTurn*.24;
    const headY=-89+headDrop;
    const look=lookBack?0:clamp(EYELINE+headDrop*10,-85,22);
    line(neckX,neckY,headX-1,headY+5,'#e5aa82',6.5);

    ctx.save();
    ctx.translate(headX,headY);
    ctx.rotate(look*Math.PI/180);
    ellipse(0,0,11,10.5,'#15447b');
    ellipse(-2,-3,7,6,'#2261a8');
    if(!lookBack){
      poly([[5,-1],[16,-3],[17,1],[8,2]],'#0e325c');
      poly([[5,1],[9,3],[7,6],[8,9],[2,9]],'#e5aa82');
      ellipse(6,2,1.2,1.2,'#122338');
      line(-1,3,7,8,'#b5c4cc',1.6);
      line(2,1,7,8,'#b5c4cc',1.4);
      line(4,4,8,7,'#b5c4cc',1.2);
    }else{
      poly([[-5,-1],[-15,-2],[-16,2],[-8,3]],'#0e325c');
      ellipse(-5,3,1.2,1.2,'#122338');
    }
    ctx.restore();

    // 5. Far (Front) Arm
    line(sxFar,syFar,farElbow.x,farElbow.y,'#1c5fa8',7);
    line(farElbow.x,farElbow.y,farElbow.x+ux*1.5,farElbow.y+uy*1.5,'#ffd25c',7);
    line(farElbow.x,farElbow.y,topGrip.x,topGrip.y,'#e5aa82',5.5);

    // 6. Cricket Bat
    if (!batBehind) paintBat();

    // The bat, its blur and the flash of contact, drawn either behind the
    // body or in front of it depending on where in the arc the blade is.
    function paintBat(){
      // Ghosted blades through the fast part of the swing, so the arc reads
      // at speed instead of strobing between frames.
      if (s.swinging && swingT > SWING.back*.5 && swingT < SWING.finish) {
        for (let i=4;i>=1;i--) {
          const gt = swingT - i*.014;
          if (gt <= SWING.back*.4) continue;
          drawBat(swingPose(gt), .26 - i*.05);
        }
      }
      drawBat(p);

      // The ball resists the bat for an instant: a small flash on contact.
      const struck = (s.pending||s.result||{}).missed === false;
      if (s.swinging && struck && Math.abs(swingT-SWING.contact) < .055) {
        const f = 1-Math.abs(swingT-SWING.contact)/.055;
        ctx.save(); ctx.globalAlpha = f*.5;
        ellipse(grip.x+ux*BAT_LEN*.74, grip.y+uy*BAT_LEN*.74, 7+(1-f)*12, 7+(1-f)*12, '#fff6d0');
        ctx.restore();
      }
    }

    function drawBat(bp, ghost) {
      const a=bp.ang*Math.PI/180, bux=Math.sin(a), buy=Math.cos(a);
      const gx=bp.hx, gy=bp.hy, tx=gx+bux*BAT_LEN, ty=gy+buy*BAT_LEN;
      const bnx=-buy, bny=bux, full=ghost===undefined;
      const knobX=gx-bux*13,knobY=gy-buy*13;
      const spliceX=gx+bux*8,spliceY=gy+buy*8;
      if(!full){ctx.save();ctx.globalAlpha=ghost;}
      if(full){
        line(knobX,knobY,spliceX,spliceY,'#f2efe9',4.2);
        for(let r=-11;r<=6;r+=2.5){
          const rx=gx+bux*r,ry=gy+buy*r;
          line(rx-bnx*1.8,ry-bny*1.8,rx+bnx*1.8,ry+bny*1.8,'#d8d4c7',.8);
        }
        ellipse(knobX,knobY,2.4,2,'#e0dcce');
      }
      const shoulder1=[spliceX+bnx*3.6,spliceY+bny*3.6];
      const shoulder2=[spliceX-bnx*3.6,spliceY-bny*3.6];
      const toe1=[tx+bnx*4.2,ty+bny*4.2];
      const toe2=[tx-bnx*4.2,ty-bny*4.2];
      poly([shoulder2,toe2,[tx,ty],[spliceX,spliceY]],'#c8a466');
      poly([[spliceX,spliceY],shoulder1,toe1,[tx,ty]],'#faeed2',full?'#bfa065':null,1);
      if(full){
        line(spliceX,spliceY,tx,ty,'#e5d1a4',1);
        const sTopX=spliceX+(tx-spliceX)*.15,sTopY=spliceY+(ty-spliceY)*.15;
        const sBotX=spliceX+(tx-spliceX)*.55,sBotY=spliceY+(ty-spliceY)*.55;
        line(sTopX,sTopY,sBotX,sBotY,'#d32f2f',3);
        line(sTopX,sTopY,sTopX+(sBotX-sTopX)*.7,sTopY+(sBotY-sTopY)*.7,'#ffd25c',1.8);
      }
      if(!full)ctx.restore();
    }

    // Batting glove drawer helper
    function drawGlove(gx,gy){
      ctx.save();ctx.translate(gx,gy);
      const a=Math.atan2(uy,ux);ctx.rotate(a);
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
    const past=clamp((s.time-s.flight)/.22,0,1);
    const groundY=mix(g.far,g.near,pers)+past*28*g.scale;
    const x=mix(g.cx+35.6*g.scale,g.cx+s.line*g.spread*BALL_SPREAD,pers);
    let z;
    if(t<s.bounce)z=83.3*g.scale*(1-t/s.bounce);
    else {
      const u=(t-s.bounce)/(1-s.bounce),rise=Math.pow(1-s.bounce,2)*340*g.scale;
      z=rise*(3.225*u-2.601*u*u)*(1-past*.5);
    }
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
    if(s.phase==='result'&&!s.result.wicket&&!s.result.missed&&s.ballFlight){
      const bf=s.ballFlight;
      const t=clamp(s.time/bf.duration,0,1);
      const x=bf.x0+bf.vx*t;
      const y=bf.y0+bf.vy*t-Math.sin(t*Math.PI)*bf.maxHeight;
      const groundY=bf.groundY0+bf.vy*t*0.35;
      if(t<1){
        line(x-bf.vx*.04,y-bf.vy*.04,x,y,'#fff7d59c',3);
        drawBall(x,y,mix(7,3.2,t),groundY);
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
  window.BoundaryBashDebug={state:()=>s,geometry,pickStroke,swingPose,backliftPose,shot,SWING,STROKES,ballAtContact,toggleDebug:()=>{s.debug=!s.debug;}};
  hud();overlay('menu');requestAnimationFrame(frame);
})();
