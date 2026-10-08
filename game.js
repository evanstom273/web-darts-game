import {NUMBERS,RADII,scoreAt,pointFor,resolveDart,checkout,chooseTarget,gaussian} from './engine.js';
import {PROTOTYPE,prototypePosition,prototypePower,prototypeLanding} from './throwing.js';

const $=id=>document.getElementById(id);
const canvas=$('dartboard'),ctx=canvas.getContext('2d');
const board=document.createElement('canvas');board.width=1400;board.height=1400;
const boardCtx=board.getContext('2d');
const C=350,R=263,TAU=Math.PI*2;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let settings={mode:'501',opponent:'computer',difficulty:'club',legs:3};
let state,aim=pointFor(20,3),charge=null,flight=null,clock=0,lastFrame=0,timers=[],throwPointer=null,dragPointer=null,announcementUntil=0;
let controls=readControlPreferences(),prototypeAim={step:0,elapsed:0,pos:0},lastClassicAim={...aim};
let soundOn=false,audioContext=null;
const colors={gold:'#e3bd76',cream:'#eee5ce',wire:'#aca88e',red:'#a43b35',green:'#28664d'};

function circle(context,x,y,r,fill,stroke,width=1){context.beginPath();context.arc(x,y,r,0,TAU);if(fill){context.fillStyle=fill;context.fill();}if(stroke){context.strokeStyle=stroke;context.lineWidth=width;context.stroke();}}
function ringSection(context,a,b,r1,r2,fill){context.beginPath();context.arc(C,C,r2,a,b);context.arc(C,C,r1,b,a,true);context.closePath();context.fillStyle=fill;context.fill();}
function drawBase(){
  const c=boardCtx;c.scale(2,2);
  c.shadowColor='#000b';c.shadowBlur=24;c.shadowOffsetY=14;
  circle(c,C,C,332,'#08100c');c.shadowBlur=0;c.shadowOffsetY=0;
  const surround=c.createRadialGradient(C,260,180,C,C,330);surround.addColorStop(0,'#344433');surround.addColorStop(1,'#243126');
  circle(c,C,C,325,surround,'#506043',1);
  circle(c,C,C,313,'#142019','#47503c',1);
  circle(c,C,C,303,'#171b15','#090e0b',6);
  const black=c.createLinearGradient(0,70,0,610);black.addColorStop(0,'#222923');black.addColorStop(1,'#131b17');
  for(let i=0;i<20;i++){
    const a=-Math.PI/2+i*Math.PI/10-Math.PI/20,b=a+Math.PI/10;
    ringSection(c,a,b,0,R,i%2===0?black:'#e6dfc8');
    ringSection(c,a,b,R*RADII.trebleInner,R*RADII.trebleOuter,i%2===0?colors.red:colors.green);
    ringSection(c,a,b,R*RADII.doubleInner,R,i%2===0?colors.red:colors.green);
  }
  // Fine, deterministic fibres give the playing surface a little depth.
  c.save();c.beginPath();c.arc(C,C,R,0,TAU);c.clip();
  let seed=93287;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  c.lineWidth=.55;
  for(let n=0;n<7200;n++){const x=C+(rnd()*2-1)*R,y=C+(rnd()*2-1)*R;c.strokeStyle=n%2?'#fff1c510':'#00000016';c.beginPath();c.moveTo(x,y);c.lineTo(x+rnd()*1.5,y+1+rnd()*3);c.stroke();}c.restore();
  for(let i=0;i<20;i++){const a=-Math.PI/2+i*Math.PI/10-Math.PI/20;c.beginPath();c.moveTo(C+Math.cos(a)*R*RADII.outerBull,C+Math.sin(a)*R*RADII.outerBull);c.lineTo(C+Math.cos(a)*R,C+Math.sin(a)*R);c.strokeStyle='#a8a58d';c.lineWidth=1.05;c.stroke();}
  for(const r of [RADII.trebleInner,RADII.trebleOuter,RADII.doubleInner,1])circle(c,C,C,R*r,null,'#aeae96',1.25);
  circle(c,C,C,R*RADII.outerBull,colors.green,'#b7b399',1.2);circle(c,C,C,R*RADII.bull,colors.red,'#c1b598',1.2);
  c.font='500 25px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<20;i++){const a=-Math.PI/2+i*Math.PI/10;c.fillStyle='#dedac7';c.fillText(NUMBERS[i],C+Math.cos(a)*285,C+Math.sin(a)*285+1);}
  circle(c,C,C,304,null,'#818270',1.1);
  c.fillStyle='#b6b195';c.font='9px Arial, sans-serif';c.letterSpacing='2px';c.fillText('THE OCHE',C,677);c.letterSpacing='0px';
}

function modalOpen(){return !!document.querySelector('dialog[open]');}
function schedule(fn,ms){timers.push({at:clock+ms,fn});}
function player(){return state.players[state.current];}
function isPractice(){return settings.mode==='practice';}
function isComputer(){return !isPractice()&&settings.opponent==='computer'&&state.current===1;}
function canThrow(){return state?.phase==='ready'&&!isComputer()&&!modalOpen()&&!document.hidden;}
function isPrototype(){return controls.mechanic==='prototype';}
function readControlPreferences(){
  const defaults={mechanic:'classic',aimingSpeed:PROTOTYPE.defaultSpeed};
  try{const value=JSON.parse(localStorage.getItem('the-oche-controls-v1'));if(value&&['classic','prototype'].includes(value.mechanic))defaults.mechanic=value.mechanic;if(value&&Number.isFinite(value.aimingSpeed)&&value.aimingSpeed>=PROTOTYPE.minSpeed&&value.aimingSpeed<=PROTOTYPE.maxSpeed)defaults.aimingSpeed=value.aimingSpeed;}catch{}
  return defaults;
}
function saveControlPreferences(){try{localStorage.setItem('the-oche-controls-v1',JSON.stringify(controls));}catch{}}
function resetPrototypeAim(){prototypeAim={step:0,elapsed:0,pos:0};if(isPrototype()&&!isComputer())aim={x:0,y:0};}
function setThrowingMechanic(mechanic){
  if(!['classic','prototype'].includes(mechanic))throw new Error('Unknown throwing mechanic.');
  if(mechanic===controls.mechanic)return;
  cancelCharge();throwPointer=null;dragPointer=null;
  if(!isPrototype()&&!isComputer())lastClassicAim={...aim};
  controls.mechanic=mechanic;resetPrototypeAim();
  if(!isPrototype()&&!isComputer())aim={...lastClassicAim};
  resetMeter();saveControlPreferences();syncControlSettings();render();
}
function setAimingSpeed(speed){
  if(!Number.isFinite(speed)||speed<PROTOTYPE.minSpeed||speed>PROTOTYPE.maxSpeed)throw new Error('Aiming speed must be between 0.15 and 1.5.');
  controls.aimingSpeed=speed;saveControlPreferences();syncControlSettings();
}
function syncControlSettings(){
  const prototype=isPrototype(),speed=controls.aimingSpeed;
  $('mechanic-classic').checked=!prototype;$('mechanic-prototype').checked=prototype;
  $('prototype-settings').classList.toggle('hidden',!prototype);
  $('mechanic-description').textContent=prototype?'Stop height, stop direction, then hold and release in the green zone.':'Aim directly on the board, then hold and release in the gold zone.';
  $('aiming-speed').value=String(speed);$('speed-label').textContent=(speed<.4?'Very slow':speed<.8?'Slow':speed<1.15?'Medium':'Fast')+' · '+speed.toFixed(2);
  $('classic-help').classList.toggle('hidden',prototype);$('prototype-help').classList.toggle('hidden',!prototype);
  $('footer-controls').textContent=prototype?'Stop height · Stop direction · Hold and release':'Tap to aim · Hold to draw · Release to throw';
}
function makePlayer(name){return {name,remaining:Number(settings.mode)||0,legs:0,points:0,darts:0,visits:0,best:0};}
function startGame(next=settings){
  settings={...next};timers=[];charge=null;flight=null;
  state={players:[makePlayer(isPractice()||settings.opponent==='computer'?'You':'Player 1')],current:0,starter:0,leg:1,phase:'ready',visitStart:0,visitTotal:0,visitBust:false,visitFinished:false,darts:[],history:[]};
  if(!isPractice())state.players.push(makePlayer(settings.opponent==='computer'?'House player':'Player 2'));
  for(const d of document.querySelectorAll('dialog'))if(d.open)d.close();
  $('board-announcement').classList.remove('show');announcementUntil=0;aim=pointFor(20,3);
  beginTurn(0);feedback(isPractice()?'No pressure. Just practice.':'Find your rhythm.',isPractice()?'Try a few throws and find your rhythm.':'Three darts. Make them count.');
}
function beginTurn(index){
  state.current=index;state.visitStart=player().remaining;state.visitTotal=0;state.visitBust=false;state.visitFinished=false;state.darts=[];flight=null;charge=null;
  state.phase=isComputer()?'ai-aim':'ready';
  resetMeter();resetPrototypeAim();render();
  if(isComputer()){feedback('The house steps up.','Watch the board — your turn is next.');schedule(computerThrow,650);}
  else {feedback(isPractice()?'A fresh set of three.':player().name==='You'?'Your turn.':player().name+' to throw.',isPractice()?'Take your time. Find your range.':isPrototype()?'Set height, set direction, then release in green.':'Aim, hold, and release in gold.');if(!isPractice()&&!isPrototype())suggestAim();}
}
function suggestAim(){const route=checkout(player().remaining,3);if(route){aim=pointFor(route[0].number,route[0].multiplier);updateAim();}}
function average(p){return p.darts?(p.points*3/p.darts).toFixed(1):'0.0';}
function feedback(title,detail,bust=false){$('shot-feedback').innerHTML='';const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=title;span.textContent=detail;$('shot-feedback').append(strong,span);$('shot-feedback').classList.toggle('bust',bust);}
function render(){
  const practice=isPractice(),p=player();
  $('mode-heading').innerHTML=practice?'Practice <span>Find your range</span>':settings.mode+' <span>Double out</span>';
  $('match-format').textContent=practice?'FREE PRACTICE':settings.legs===1?'SINGLE LEG':'BEST OF '+settings.legs+' LEGS';
  $('leg-label').textContent=practice?p.darts+' darts thrown':'Leg '+state.leg;
  $('scoreboard-label').textContent=practice?'AT THE PRACTICE BOARD':'THE MATCH';
  $('match-difficulty').textContent=practice?'NO LIMITS':settings.opponent==='local'?'PASS & PLAY':settings.difficulty.toUpperCase();
  $('player-scores').innerHTML=state.players.map((v,i)=>'<div class="player-score '+(i===state.current?'active':'')+'"><div class="player-name">'+v.name+(i===state.current&&!practice?'<em>AT THE OCHE</em>':'')+'</div><strong class="score-value">'+(practice?v.points+(!state.visitFinished?state.visitTotal:0):v.remaining)+'</strong><div class="player-sub"><span>'+ (practice?'Best visit':'Legs')+' <b>'+(practice?v.best:v.legs)+'</b></span><span>3-dart avg <b>'+average(v)+'</b></span></div></div>').join('');
  $('turn-label').textContent=isComputer()?'HOUSE PLAYER':practice?'YOUR THROW':p.name==='You'?'YOUR THROW':p.name.toUpperCase()+' TO THROW';
  $('visit-number').textContent='VISIT '+(p.visits+(state.visitFinished?0:1));
  $('dart-slots').innerHTML=[0,1,2].map(i=>{const dart=state.darts[i];return '<div class="dart-slot '+(dart?'hit ':'')+(state.visitBust?'bust ':!dart&&i===state.darts.length?'next':'')+'">'+(dart?'<b>'+dart.hit.value+'</b><small>'+dart.hit.short+'</small>':'<span>0'+(i+1)+'</span>')+'</div>';}).join('');
  $('visit-total').textContent=state.visitBust?'BUST':state.visitTotal;
  const route=!practice&&!state.visitFinished?checkout(p.remaining,3-state.darts.length):null;
  $('checkout-hint').textContent=practice?'Best visit: '+p.best:route?'Finish: '+route.map(h=>h.short).join(' · '):state.visitBust?'Score reset to '+state.visitStart:state.phase==='turn-end'?'Visit complete':'Aim for the treble 20';
  const end=state.phase==='turn-end';
  $('throw-button').classList.toggle('hidden',end);
  $('continue-button').classList.toggle('hidden',!end);
  $('continue-button').textContent=practice?'Next visit':settings.opponent==='computer'?"Computer’s turn":'Pass to '+state.players[1-state.current].name;
  $('throw-button').disabled=state.phase!=='ready'||isComputer();
  $('throw-button').classList.toggle('charging',!!charge);
  $('throw-label').textContent=charge?'Release in gold':isComputer()?'House player throwing…':state.phase==='flight'?'In the air…':state.phase==='leg-end'||state.phase==='match-end'?'Game shot':'Hold to throw';
  $('throw-shortcut').textContent=isComputer()?'Your turn is coming up':charge?'Find the moment. Let go.':'then release in the gold zone';
  $('control-note').textContent=end?'Collect the darts when you’re ready.':isComputer()?'Watch the house player’s visit.':'Hold the button or Space. Release to throw.';
  $('board-tip').textContent=isComputer()?'House player at the oche':state.phase==='turn-end'?'Three darts down. Ready for the next visit?':'Tap or drag on the board to aim';
  renderThrowControls();
  $('history-count').textContent=state.history.length;
  $('visit-history').innerHTML=state.history.length?state.history.slice(0,30).map(v=>'<div class="history-row"><span>'+v.name+'</span><span>'+v.darts.join(' · ')+'</span><strong>'+(v.bust?'BUST':v.total)+'</strong></div>').join(''):'<p class="empty-history">Your first visit starts here.</p>';
  updateAim();
}
function renderThrowControls(){
  const prototype=isPrototype(),humanPrototype=prototype&&!isComputer(),step=prototypeAim.step,ready=state.phase==='ready';
  $('release-meter').classList.toggle('prototype-meter',prototype);
  $('release-meter').setAttribute('aria-label',prototype?'Throw charge, release in the green zone around 65 percent':'Throw timing, release in the gold zone');
  $('meter-start-label').textContent=prototype?'0%':'HOLD';$('meter-zone-label').textContent=prototype?'RELEASE IN GREEN · 65%':'RELEASE IN GOLD';
  $('timing-controls').classList.toggle('hidden',humanPrototype&&(step!==2||!ready));
  $('prototype-steps').classList.toggle('hidden',!humanPrototype||!ready||step===3);
  ['step-height','step-direction','step-release'].forEach((id,index)=>{$(id).classList.toggle('active',index===step);$(id).classList.toggle('complete',index<step);});
  $('aim-heading').textContent=prototype?'THREE-STAGE':'AIMING AT';
  canvas.classList.toggle('guide-control',humanPrototype);
  if(humanPrototype&&ready){
    $('throw-label').textContent=step===0?'Stop height':step===1?'Stop direction':step===3?'Next dart':charge?'Release in green':'Hold and release';
    $('throw-shortcut').textContent=step===0?'lock the horizontal guide':step===1?'lock the vertical guide':step===3?'line up your next throw':charge?'Aim for the middle of the green zone':'charge to around 65%';
    $('control-note').textContent=step===2?'Hold the button or Space. Release in green.':step===3?'Press the button or Space to line up again.':'Press the button or Space to stop the guide.';
    $('board-tip').textContent=step===0?'1 · Stop the moving line at your chosen height':step===1?'2 · Stop the sideways line at your chosen position':step===2?'3 · Hold to charge. Release in green.':'Ready to line up the next dart?';
  }
}
function updateAim(){
  const label=scoreAt(aim.x,aim.y).label,prototype=isPrototype()&&!isComputer();
  $('aim-label').textContent=prototype&&state.phase==='ready'&&prototypeAim.step<2?prototypeAim.step===0?'Set height':'Set direction':label;
  canvas.setAttribute('aria-label',prototype?'Dartboard with moving guides. Press Space to stop height, press again to stop direction, then hold and release Space in the green zone.':'Dartboard. Aiming at '+label+'. Arrow keys to aim. Hold and release Space to throw.');
}
function resetMeter(){charge=null;$('meter-marker').style.left='0%';$('release-meter').setAttribute('aria-valuenow','0');$('release-meter').classList.remove('charging');$('throw-button').classList.remove('charging');}
function powerAt(t){const cycle=(t/1150)%2;return cycle<=1?cycle:2-cycle;}
function swayAt(t){return {x:Math.sin(t*.0027)*.007+Math.sin(t*.0061)*.002,y:Math.cos(t*.0022)*.006};}
function beginCharge(){if(!canThrow()||charge||isPrototype()&&prototypeAim.step!==2)return;unlockAudio();charge={start:clock};$('release-meter').classList.add('charging');render();}
function actionDown(){
  if(!canThrow())return;
  if(!isPrototype()){beginCharge();return;}
  unlockAudio();
  if(prototypeAim.step===0){aim.y=prototypeAim.pos;prototypeAim.step=1;prototypeAim.elapsed=0;prototypeAim.pos=0;render();}
  else if(prototypeAim.step===1){aim.x=prototypeAim.pos;prototypeAim.step=2;resetMeter();render();}
  else if(prototypeAim.step===2)beginCharge();
  else {resetPrototypeAim();resetMeter();render();}
}
function cancelCharge(){if(!charge)return;resetMeter();render();}
function releaseCharge(){
  if(!charge)return;
  if(!canThrow()){cancelCharge();return;}
  const hold=clock-charge.start;
  if(isPrototype()){
    const power=prototypePower(hold),result=prototypeLanding(aim,power);
    const quality=(result.accurate?'Accurate release':'Outside green — dart scattered')+' · '+Math.round(power*100)+'%';
    charge=null;prototypeAim.step=3;$('release-meter').classList.remove('charging');launch(result.point,quality,false);return;
  }
  if(hold<110){cancelCharge();feedback('Hold a little longer.','Let the marker reach the gold band.');return;}
  const power=powerAt(hold),error=.62-power,sway=swayAt(clock);
  const landing={x:aim.x+sway.x+Math.sin(clock*.003)*Math.abs(error)*.07,y:aim.y+sway.y+error*.40};
  const quality=Math.abs(error)<.035?'Perfect release':Math.abs(error)<.07?'Good release':error>0?'Early release — landed low':'Late release — landed high';
  charge=null;$('release-meter').classList.remove('charging');launch(landing,quality,false);
}
function launch(point,quality,bot){
  state.phase='flight';flight={point,quality,bot,start:clock,duration:reducedMotion?100:340};render();playSound('throw');
}
function finishFlight(){
  const shot=flight;flight=null;
  const hit=scoreAt(shot.point.x,shot.point.y),p=player();
  state.darts.push({x:shot.point.x,y:shot.point.y,hit,at:clock,bot:shot.bot});p.darts++;
  if(isPractice())state.visitTotal+=hit.value;
  else {
    const result=resolveDart(p.remaining,state.visitStart,hit);p.remaining=result.remaining;state.visitBust=result.bust;
    if(!result.bust)state.visitTotal+=hit.value;
    if(result.won){finishVisit();p.legs++;state.phase=p.legs>=Math.ceil(settings.legs/2)?'match-end':'leg-end';feedback('Game shot!',p.name+' finishes on '+hit.label.toLowerCase()+'.');announce('GAME SHOT');playSound('win');render();schedule(showResult,1000);return;}
  }
  playSound(hit.value===50||hit.multiplier===3?'good':'hit');
  if(state.visitBust){feedback('Bust. Take a breath.','Back to '+state.visitStart+' — the whole visit is undone.',true);announce('BUST');playSound('bust');}
  else{feedback(hit.value===0?'Just outside.':hit.label+'.',shot.bot?hit.value+' scored.':shot.quality+' · '+hit.value+' scored');if(hit.value===50)announce('BULLSEYE');}
  if(state.darts.length===3||state.visitBust){
    finishVisit();
    if(state.visitTotal===180&&!state.visitBust){announce('180');feedback('One hundred and eighty!','Three in the treble. Beautifully done.');playSound('win');}
    state.phase=isComputer()?'ai-finished':'turn-end';render();
    if(isComputer())schedule(()=>beginTurn(0),1250);
  }else{state.phase=isComputer()?'ai-aim':'ready';render();if(isComputer())schedule(computerThrow,950);}
}
function finishVisit(){
  if(state.visitFinished)return;
  state.visitFinished=true;const total=state.visitBust?0:state.visitTotal,p=player();p.points+=total;p.best=Math.max(p.best,total);p.visits++;
  state.history.unshift({name:p.name,total,bust:state.visitBust,darts:state.darts.map(d=>d.hit.short)});
}
function nextTurn(){if(state.phase!=='turn-end')return;beginTurn(isPractice()?0:1-state.current);}
function computerThrow(){
  if(!isComputer()||state.phase!=='ai-aim')return;
  const target=chooseTarget(player().remaining,3-state.darts.length);aim=pointFor(target.number,target.multiplier);updateAim();
  const sigma={casual:.15,club:.072,expert:.026}[settings.difficulty];
  const point={x:aim.x+gaussian()*sigma,y:aim.y+gaussian()*sigma};
  schedule(()=>launch(point,'',true),500);
}
function nextLeg(){
  if(state.phase==='match-end'){startGame();return;}
  if(state.phase!=='leg-end')return;
  state.leg++;state.starter=1-state.starter;
  for(const p of state.players)p.remaining=Number(settings.mode);
  timers=[];$('result-dialog').close();beginTurn(state.starter);
}
function showResult(){
  const p=player(),wonMatch=state.phase==='match-end';
  $('result-eyebrow').textContent=wonMatch?'MATCH COMPLETE':'GAME SHOT';
  $('result-number').textContent=state.players.map(p=>p.legs).join(' — ');
  $('result-title').textContent=(p.name==='You'?'You take':p.name+' takes')+(wonMatch?' the match.':' the leg.');
  $('result-description').textContent=wonMatch?(p.name==='You'?'A well-earned finish. Fancy another?':p.name+' found the finish. There’s always the next match.'):'The opening throw alternates. Next up: '+state.players[1-state.starter].name+'.';
  $('result-stats').innerHTML='<div><strong>'+average(p)+'</strong><span>3-dart average</span></div><div><strong>'+p.best+'</strong><span>Best visit</span></div><div><strong>'+p.darts+'</strong><span>Darts thrown</span></div>';
  $('result-continue').textContent=wonMatch?'Play again':'Next leg';
  if(!$('result-dialog').open)$('result-dialog').showModal();
}
function announce(text){$('board-announcement').textContent=text;$('board-announcement').classList.add('show');announcementUntil=clock+1250;}

function drawDart(x,y,bot=false,scale=1){
  const px=C+x*R,py=C+y*R;cSave();ctx.translate(px,py);ctx.rotate(-.42);ctx.scale(scale,scale);
  ctx.shadowColor='#0009';ctx.shadowBlur=3;ctx.shadowOffsetX=3;ctx.shadowOffsetY=4;
  ctx.strokeStyle='#dedfce';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-18);ctx.stroke();
  ctx.strokeStyle='#959e90';ctx.lineWidth=4.2;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(0,-35);ctx.stroke();
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  for(let i=0;i<6;i++){ctx.strokeStyle=i%2?'#d3d4bf':'#5c6b61';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,-18-i*2.5);ctx.lineTo(2,-18-i*2.5);ctx.stroke();}
  ctx.strokeStyle='#ced0c4';ctx.lineWidth=1.9;ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(0,-55);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-38);ctx.lineTo(-9,-53);ctx.lineTo(-7,-66);ctx.lineTo(0,-62);ctx.lineTo(7,-66);ctx.lineTo(9,-53);ctx.closePath();ctx.fillStyle=bot?'#709b96':'#d9b46d';ctx.fill();
  ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(0,-64);ctx.strokeStyle=bot?'#c0d4c8':'#fff0ba';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}
function cSave(){ctx.save();}
function drawPrototypeGuides(){
  const step=prototypeAim.step,guide='#79d4e8',locked='#f2cb75';
  ctx.save();ctx.shadowColor='#07130f';ctx.shadowBlur=4;ctx.lineWidth=1.8;
  if(step<2){
    ctx.setLineDash([7,6]);ctx.strokeStyle=step===0?guide:locked;
    const y=C+(step===0?prototypeAim.pos:aim.y)*R;
    ctx.beginPath();ctx.moveTo(C-R,y);ctx.lineTo(C+R,y);ctx.stroke();
    if(step===1){const x=C+prototypeAim.pos*R;ctx.strokeStyle=guide;ctx.beginPath();ctx.moveTo(x,C-R);ctx.lineTo(x,C+R);ctx.stroke();}
  }else{
    const x=C+aim.x*R,y=C+aim.y*R;ctx.strokeStyle=locked;ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x+14,y);ctx.moveTo(x,y-14);ctx.lineTo(x,y+14);ctx.stroke();circle(ctx,x,y,8,null,locked,1.2);
  }
  ctx.restore();
}
function drawFrame(){
  ctx.clearRect(0,0,700,700);ctx.drawImage(board,0,0,700,700);
  for(const dart of state.darts){
    if(clock-dart.at<400&&!reducedMotion){const progress=(clock-dart.at)/400;circle(ctx,C+dart.x*R,C+dart.y*R,5+progress*18,null,'rgba(238,204,136,'+(1-progress)*.7+')',1.5);}
    drawDart(dart.x,dart.y,dart.bot);
  }
  if((state.phase==='ready'||state.phase==='ai-aim')&&!modalOpen()){
    if(isPrototype()&&!isComputer())drawPrototypeGuides();
    else{
    const sway=swayAt(clock),ax=C+(aim.x+(charge?sway.x:0))*R,ay=C+(aim.y+(charge?sway.y:0))*R,color=isComputer()?'#a3c7be':'#f4cf7f';
    ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=5;
    circle(ctx,ax,ay,charge?10:12,null,color,1.4);circle(ctx,ax,ay,2,color);
    ctx.strokeStyle=color;ctx.lineWidth=1.4;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.beginPath();ctx.moveTo(ax+dx*16,ay+dy*16);ctx.lineTo(ax+dx*21,ay+dy*21);ctx.stroke();}ctx.restore();
    }
  }
  if(flight){
    const t=Math.min(1,(clock-flight.start)/flight.duration),e=1-Math.pow(1-t,2);
    const x=flight.point.x*e,y=1.7+(flight.point.y-1.7)*e;
    drawDart(x,y,flight.bot,1+(1-e)*1.8);
  }
}
function frame(real){
  const delta=lastFrame?Math.min(70,real-lastFrame):16;lastFrame=real;
  if(!modalOpen()&&!document.hidden){
    clock+=delta;
    if(isPrototype()&&canThrow()&&prototypeAim.step<2){prototypeAim.elapsed+=Math.min(delta,50)/1000;prototypeAim.pos=prototypePosition(prototypeAim.elapsed,controls.aimingSpeed);}
    if(charge){const p=isPrototype()?prototypePower(clock-charge.start):powerAt(clock-charge.start);$('meter-marker').style.left=p*100+'%';$('release-meter').setAttribute('aria-valuenow',String(Math.round(p*100)));}
    if(flight&&clock-flight.start>=flight.duration)finishFlight();
    const due=timers.filter(t=>t.at<=clock);timers=timers.filter(t=>t.at>clock);for(const t of due)t.fn();
    if(announcementUntil&&clock>announcementUntil){$('board-announcement').classList.remove('show');announcementUntil=0;}
  }
  drawFrame();requestAnimationFrame(frame);
}
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(700*dpr);canvas.height=Math.round(700*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function setAimFromPointer(e){if(!canThrow()||charge||isPrototype())return;const rect=canvas.getBoundingClientRect();aim={x:((e.clientX-rect.left)/rect.width*700-C)/R,y:((e.clientY-rect.top)/rect.height*700-C)/R};const radius=Math.hypot(aim.x,aim.y);if(radius>1.12){aim.x*=1.12/radius;aim.y*=1.12/radius;}updateAim();}

canvas.addEventListener('pointerdown',e=>{if(!canThrow())return;e.preventDefault();canvas.focus({preventScroll:true});if(isPrototype())return;dragPointer=e.pointerId;canvas.setPointerCapture(e.pointerId);setAimFromPointer(e);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===dragPointer)setAimFromPointer(e);});
canvas.addEventListener('pointerup',()=>{dragPointer=null;});canvas.addEventListener('pointercancel',()=>{dragPointer=null;});
canvas.addEventListener('keydown',e=>{if(!canThrow()||charge||isPrototype()||!e.key.startsWith('Arrow'))return;e.preventDefault();const amount=e.shiftKey?.004:.017;aim.x+=e.key==='ArrowRight'?amount:e.key==='ArrowLeft'?-amount:0;aim.y+=e.key==='ArrowDown'?amount:e.key==='ArrowUp'?-amount:0;aim.x=Math.max(-1.1,Math.min(1.1,aim.x));aim.y=Math.max(-1.1,Math.min(1.1,aim.y));updateAim();});
const throwButton=$('throw-button');
throwButton.addEventListener('pointerdown',e=>{if(e.button!==0||!canThrow()||throwPointer!==null)return;e.preventDefault();throwPointer=e.pointerId;throwButton.setPointerCapture(e.pointerId);actionDown();});
throwButton.addEventListener('pointerup',e=>{if(e.pointerId!==throwPointer)return;e.preventDefault();throwPointer=null;releaseCharge();});
throwButton.addEventListener('pointercancel',()=>{throwPointer=null;cancelCharge();});
throwButton.addEventListener('lostpointercapture',()=>{if(throwPointer!==null){throwPointer=null;cancelCharge();}});
throwButton.addEventListener('contextmenu',e=>e.preventDefault());
throwButton.addEventListener('click',e=>{if(e.detail===0){if(charge)releaseCharge();else actionDown();}});
document.addEventListener('keydown',e=>{const eligible=[document.body,document.documentElement,canvas,throwButton].includes(e.target);if(eligible&&!modalOpen()&&(e.code==='Space'||e.key==='Enter'&&e.target===throwButton)){e.preventDefault();if(!e.repeat)actionDown();}});
document.addEventListener('keyup',e=>{if((e.code==='Space'||e.key==='Enter')&&charge){e.preventDefault();releaseCharge();}});
window.addEventListener('blur',cancelCharge);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCharge();});
$('continue-button').addEventListener('click',()=>{unlockAudio();nextTurn();});
function openDialog(id){cancelCharge();$(id).showModal();}
$('new-game').addEventListener('click',()=>openDialog('setup-dialog'));
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('settings-button').addEventListener('click',()=>{syncControlSettings();openDialog('settings-dialog');});
$('mechanic-classic').addEventListener('change',e=>{if(e.target.checked)setThrowingMechanic('classic');});
$('mechanic-prototype').addEventListener('change',e=>{if(e.target.checked)setThrowingMechanic('prototype');});
$('aiming-speed').addEventListener('input',e=>setAimingSpeed(Number(e.target.value)));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog&&dialog.id!=='result-dialog'){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('setup-form').addEventListener('change',()=>{const form=new FormData($('setup-form'));$('match-options').classList.toggle('hidden',form.get('mode')==='practice');$('difficulty-setting').classList.toggle('hidden',form.get('opponent')==='local');});
$('setup-form').addEventListener('submit',e=>{e.preventDefault();const form=new FormData(e.currentTarget);startGame({mode:form.get('mode'),opponent:form.get('opponent'),difficulty:form.get('difficulty'),legs:Number(form.get('legs'))});});
$('result-dialog').addEventListener('cancel',e=>e.preventDefault());
$('result-continue').addEventListener('click',()=>{unlockAudio();nextLeg();});
$('result-new').addEventListener('click',()=>{$('result-dialog').close();openDialog('setup-dialog');});
$('setup-dialog').addEventListener('close',()=>{if((state.phase==='leg-end'||state.phase==='match-end')&&!$('result-dialog').open)showResult();});

function unlockAudio(){if(!soundOn)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')void audioContext.resume().catch(()=>{});}catch{soundOn=false;$('sound-toggle').textContent='Sound off';$('sound-toggle').setAttribute('aria-pressed','false');}}
function playSound(type){
  if(!soundOn||!audioContext||audioContext.state!=='running')return;
  const ac=audioContext,now=ac.currentTime;
  if(type==='throw'||type==='hit'||type==='good'){
    const dur=type==='throw'?.10:.09,buffer=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
    const source=ac.createBufferSource();source.buffer=buffer;const filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.value=type==='throw'?2300:620;const gain=ac.createGain();gain.gain.value=type==='throw'?.07:.3;source.connect(filter).connect(gain).connect(ac.destination);source.start(now);
  }
  if(type==='win'||type==='good'||type==='bust'){
    const notes=type==='win'?[440,554.4,659.3,880]:type==='good'?[660,880]:[180,140];
    notes.forEach((hz,i)=>{const osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,now+i*.10);gain.gain.linearRampToValueAtTime(.07,now+i*.10+.01);gain.gain.exponentialRampToValueAtTime(.001,now+i*.10+.22);osc.connect(gain).connect(ac.destination);osc.start(now+i*.10);osc.stop(now+i*.10+.25);});
  }
}
$('sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;$('sound-toggle').textContent=soundOn?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(soundOn));unlockAudio();if(soundOn)playSound('good');});

// Optional page-scoped tools use the same match state and actions as the controls.
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const snapshot=()=>({mode:settings.mode,opponent:settings.opponent,leg:state.leg,phase:state.phase,turn:player().name,throwingMechanic:controls.mechanic,aimingSpeed:controls.aimingSpeed,players:state.players.map(p=>({name:p.name,remaining:isPractice()?null:p.remaining,legs:p.legs,average:Number(average(p)),bestVisit:p.best})),visit:state.darts.map(d=>d.hit.short)});
  const register=tool=>{try{void Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'get_darts_match',title:'Read darts match',description:'Read the current score, player, leg, and darts in this visit.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('No arguments expected.');return snapshot();}});
  register({name:'start_darts_game',title:'Start a darts game',description:'Replace the current game with a new 501, 301, or practice game using the visible game settings.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['501','301','practice']},opponent:{type:'string',enum:['computer','local']},difficulty:{type:'string',enum:['casual','club','expert']},legs:{type:'integer',enum:[1,3,5]}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['mode','opponent','difficulty','legs'].includes(k))||!['501','301','practice'].includes(input.mode)||input.opponent!==undefined&&!['computer','local'].includes(input.opponent)||input.difficulty!==undefined&&!['casual','club','expert'].includes(input.difficulty)||input.legs!==undefined&&![1,3,5].includes(input.legs))throw new Error('Invalid game settings.');startGame({mode:input.mode,opponent:input.opponent??'computer',difficulty:input.difficulty??'club',legs:input.legs??3});return snapshot();}});
}
drawBase();resize();startGame();syncControlSettings();requestAnimationFrame(frame);window.addEventListener('resize',resize);
