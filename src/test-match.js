/* Timeless, two-innings cricket. Pure match state shared with the tests. */
(function(root) {
  'use strict';
  // A custom game XI, not a claim about today's international selection.
  const teams = {
    Australia: ['Liam','Usman Khawaja','Marnus Labuschagne','Steve Smith','Travis Head','Mitchell Marsh','Alex Carey','Pat Cummins','Mitchell Starc','Nathan Lyon','Josh Hazlewood'],
    England: ['Zak Crawley','Ben Duckett','Ollie Pope','Joe Root','Harry Brook','Ben Stokes','Jamie Smith','Chris Woakes','Gus Atkinson','Mark Wood','Shoaib Bashir']
  };
  const current = m => m.innings[m.innings.length-1];
  const other = team => team==='Australia'?'England':'Australia';
  const total = (m,team) => m.innings.filter(i=>i.team===team).reduce((n,i)=>n+i.runs,0);
  function newInnings(m,team) {
    const number=m.innings.filter(i=>i.team===team).length+1;
    const i={team,number,runs:0,wickets:0,balls:0,striker:0,partner:1,next:2,
      declared:false,closed:false,history:[],fall:[],
      batters:teams[team].map(name=>({name,runs:0,balls:0,fours:0,sixes:0,out:false,entered:false}))};
    i.batters[0].entered=i.batters[1].entered=true;
    if(m.innings.length===3)i.target=total(m,other(team))-total(m,team)+1;
    m.innings.push(i);m.status=team==='Australia'?'batting':'simulation';
    return i;
  }
  function create(first='Australia',seed=Date.now()) {
    const m={version:1,seed:(seed>>>0)||1,innings:[],status:'batting',result:null};
    newInnings(m,first==='England'?'England':'Australia');return m;
  }
  function end(m,winner,margin) {
    m.status='complete';m.result={winner,margin,text:winner?`${winner} win by ${margin}`:'MATCH TIED'};
  }
  function close(m) {
    const i=current(m);i.closed=true;m.status='interval';
    const count=m.innings.length;
    if(count===3 && total(m,i.team)<total(m,other(i.team))) {
      const runs=total(m,other(i.team))-total(m,i.team);
      end(m,other(i.team),`an innings and ${runs} run${runs===1?'':'s'}`);
    } else if(count===4) {
      const diff=total(m,i.team)-total(m,other(i.team));
      if(diff>0)end(m,i.team,`${10-i.wickets} wicket${10-i.wickets===1?'':'s'}`);
      else if(diff===0)end(m,null,'tie');
      else end(m,other(i.team),`${-diff} run${diff===-1?'':'s'}`);
    }
  }
  function ball(m,runs,wicket=false) {
    const i=current(m);
    if(i.closed || !['batting','simulation'].includes(m.status))return;
    if(!Number.isInteger(runs)||runs<0||runs>6||runs===5)throw new Error('Invalid runs');
    const b=i.batters[i.striker];b.balls++;i.balls++;
    if(wicket) {
      b.out=true;i.wickets++;i.fall.push({runs:i.runs,wicket:i.wickets,balls:i.balls,name:b.name});
      if(i.wickets<10){i.striker=i.next++;i.batters[i.striker].entered=true;}
    } else {
      i.runs+=runs;b.runs+=runs;if(runs===4)b.fours++;if(runs===6)b.sixes++;
      if(runs%2)[i.striker,i.partner]=[i.partner,i.striker];
    }
    // Only the current/recent over is retained; long player innings are unbounded.
    if((i.balls-1)%6===0)i.history=[];
    i.history.push(wicket?'W':runs);
    if(i.wickets===10 || (i.target && i.runs>=i.target)){close(m);return;}
    if(i.balls%6===0)[i.striker,i.partner]=[i.partner,i.striker];
  }
  function declare(m) {
    const i=current(m);if(m.status!=='batting'||i.closed)return;
    i.declared=true;close(m);
  }
  function advance(m) {
    if(m.status!=='interval')return;
    newInnings(m,other(current(m).team));
  }
  function random(m) {
    let x=m.seed;x^=x<<13;x^=x>>>17;x^=x<<5;m.seed=x>>>0;return m.seed/4294967296;
  }
  function simulate(m) {
    if(m.status!=='simulation')return;
    const i=current(m);
    // About 3 runs/over, with stronger top-order batters. Every delivery is
    // scored through the same strike, wicket, target and scorecard rules.
    while(!i.closed) {
      const tail=i.striker>=7, wicket=random(m)<(tail?.032:.018);
      const r=random(m);
      const runs=r<.69?0:r<.875?1:r<.93?2:r<.935?3:r<.992?4:6;
      ball(m,runs,wicket);
    }
  }
  function situation(m) {
    const i=current(m);
    if(m.result)return m.result.text;
    if(i.target)return `${i.team} need ${Math.max(0,i.target-i.runs)} to win · target ${i.target}`;
    if(m.innings.length===1)return 'First innings · no over limit';
    const lead=total(m,i.team)-total(m,other(i.team));
    return lead===0?'Scores level':`${i.team} ${lead>0?'lead by':'trail by'} ${Math.abs(lead)}`;
  }
  function restore(text) {
    try {
      const m=JSON.parse(text);
      if(m.version!==1 || !Number.isInteger(m.seed) || !['batting','simulation','interval','complete'].includes(m.status)
        || !Array.isArray(m.innings)||m.innings.length<1||m.innings.length>4)return null;
      for(const i of m.innings) {
        if(!teams[i.team]||!Array.isArray(i.batters)||i.batters.length!==11||!Array.isArray(i.history)
          ||!Number.isInteger(i.runs)||i.runs<0||!Number.isInteger(i.wickets)||i.wickets<0||i.wickets>10
          ||!Number.isInteger(i.balls)||i.balls<0||!Number.isInteger(i.striker)||i.striker<0||i.striker>10
          ||!Number.isInteger(i.partner)||i.partner<0||i.partner>10)return null;
        if(i.batters.some((b,n)=>b.name!==teams[i.team][n]||!Number.isInteger(b.runs)||b.runs<0||!Number.isInteger(b.balls)||b.balls<0))return null;
      }
      return m;
    }catch(_){return null;}
  }
  const api={teams,create,current,total,ball,declare,advance,simulate,situation,restore};
  if(typeof module!=='undefined')module.exports=api;else root.TestMatch=api;
})(typeof window!=='undefined'?window:globalThis);
