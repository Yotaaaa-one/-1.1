"use strict";

const STORAGE_KEY = "pga-tour-18-save-v5";
const ATTACK_SHOT_LIMIT = 6;
const CHARACTERS=[
  {id:"balance",name:"バランスプロ",tag:"BALANCED",description:"すべての能力が平均的で扱いやすい",power:78,accuracy:78,control:78,shortGame:78,putting:78,specialty:"normal",weakness:"なし"},
  {id:"power",name:"パワープロ",tag:"POWER",description:"飛距離が出るが、左右ブレが大きい",power:92,accuracy:62,control:66,shortGame:70,putting:70,specialty:"attack",weakness:"バンカー・細かい距離感"},
  {id:"technique",name:"テクニックプロ",tag:"TECHNIQUE",description:"飛距離は控えめだが、方向性とパットが安定",power:68,accuracy:88,control:86,shortGame:88,putting:86,specialty:"layup",weakness:"攻めて打つ"}
];
const AIM_OPTIONS=[{id:"left",name:"左",value:-1},{id:"leftSoft",name:"やや左",value:-.5},{id:"center",name:"中央",value:0},{id:"rightSoft",name:"やや右",value:.5},{id:"right",name:"右",value:1}];
const HOLE_DATA = [
  [4,412,2,2,3,0,2,"right"],[5,536,2,2,2,2,3,"none"],[3,168,1,1,2,0,4,"none"],
  [4,438,4,4,3,0,3,"left"],[4,381,2,2,2,3,2,"right"],[3,204,4,3,4,2,5,"right"],
  [5,562,3,2,3,4,2,"none"],[4,424,3,4,2,0,3,"left"],[4,455,5,4,4,3,4,"both"],
  [4,397,2,2,3,0,2,"none"],[3,184,3,3,2,2,4,"left"],[5,548,2,2,2,3,2,"none"],
  [4,446,4,4,3,4,3,"right"],[4,371,1,1,2,0,2,"none"],[3,215,5,4,4,5,5,"left"],
  [5,579,4,3,4,4,3,"right"],[4,405,2,2,3,0,2,"none"],[4,463,5,5,4,3,4,"both"]
];
const holes=HOLE_DATA.map((h,i)=>({number:i+1,par:h[0],yards:h[1],difficulty:h[2],leftRisk:h[3],rightRisk:h[4],waterRisk:h[5],bunkerRisk:h[6],obSide:h[7]}));
const cpuNames=["R. MORIKAWA","J. THOMAS","S. KIM","T. FLEETWOOD","H. MATSUYAMA","V. HOVLAND","X. SCHAUFFELE","S. THEEGALA","M. FITZPATRICK","C. SMITH","T. HATTON","W. CLARK","P. CANTLAY","J. DAY","A. SCOTT","B. KOEPKA","L. ÅBERG","S. IM","K. BRADLEY","T. FINAU"];
const GRADE_INFO={PERFECT:{label:"PERFECT SHOT!",quality:1},GOOD:{label:"GOOD SHOT",quality:.78},NORMAL:{label:"NORMAL SHOT",quality:.52},MISS:{label:"MISS HIT",quality:.25},BAD:{label:"BAD SHOT",quality:0}};
const TIMING_PROFILES={
  normal:{key:"normal",label:"STANDARD",perfect:6,good:16,normal:30,miss:45},
  attack:{key:"attack",label:"HIGH RISK",perfect:4,good:12,normal:25,miss:40},
  layup:{key:"layup",label:"SAFE",perfect:12,good:26,normal:40,miss:52},
  puttShort:{key:"putt-short",label:"1m以内 · EASY",perfect:18,good:48,normal:70,miss:90},
  puttNear:{key:"putt-near",label:"2–3m · WIDE",perfect:13,good:34,normal:58,miss:80},
  puttStandard:{key:"putt-standard",label:"4–6m · STANDARD",perfect:6,good:16,normal:30,miss:45},
  puttLong:{key:"putt-long",label:"7–10m · TOUGH",perfect:4,good:12,normal:26,miss:42},
  puttVeryLong:{key:"putt-very-long",label:"10m+ · EXPERT",perfect:3,good:9,normal:20,miss:38}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state=loadState(), resultTimer, timingFrame, timingStart=0, timingPosition=0, pendingShot=null, pendingTimingProfile=null, shotAnimationFrame, isShotAnimating=false, selectedCharacterId="balance";

function timingProfileFor(opt,current){
  if(current.lie!=="green"){const base=TIMING_PROFILES[opt.id]||TIMING_PROFILES.normal,character=characterById(current.characterId),specialty=character.specialty===opt.id?1.5:0;return{...base,perfect:base.perfect+specialty,good:base.good+specialty*1.5}}
  const d=current.distance;
  return d<=1?TIMING_PROFILES.puttShort:d<=3?TIMING_PROFILES.puttNear:d<=6?TIMING_PROFILES.puttStandard:d<=10?TIMING_PROFILES.puttLong:TIMING_PROFILES.puttVeryLong;
}
function timingResult(position,profile=TIMING_PROFILES.normal){
  const deviation=Math.abs(position-50)*2,side=position<50?"left":position>50?"right":"center";
  const grade=deviation<=profile.perfect?"PERFECT":deviation<=profile.good?"GOOD":deviation<=profile.normal?"NORMAL":deviation<=profile.miss?"MISS":"BAD";
  return{position,deviation,side,grade,profile:profile.key,...GRADE_INFO[grade]};
}
function characterById(id){return CHARACTERS.find(character=>character.id===id)||CHARACTERS[0]}
function aimById(id){return AIM_OPTIONS.find(aim=>aim.id===id)||AIM_OPTIONS[2]}
function freshState(name="PLAYER",characterId=selectedCharacterId){
  const character=characterById(characterId);
  const cpu=cpuNames.map((name,i)=>{const skill=69+Math.floor(Math.random()*22);return{name,skill,scores:simulateCpu(skill),country:["USA","JPN","KOR","ENG","NOR","AUS","SWE"][i%7]}});
  return{version:5,started:true,complete:false,name:name.trim().toUpperCase()||"PLAYER",characterId:character.id,characterName:character.name,power:character.power,accuracy:character.accuracy,control:character.control,shortGame:character.shortGame,putting:character.putting,aim:"center",lastShotOrigin:null,hole:0,strokes:0,lie:"tee",distance:holes[0].yards,position:{progress:0,lateral:0},greenPosition:null,attackShotsRemaining:ATTACK_SHOT_LIMIT,winds:holes.map(()=>+(1+Math.random()*5).toFixed(1)),scores:Array(18).fill(null),shots:Array.from({length:18},()=>[]),cpu};
}
function migrate(saved){
  if(!saved?.started)return saved||{started:false};
  const character=characterById(saved.characterId);saved.version=5;saved.characterId ||= character.id;saved.characterName ||= character.name;saved.control ??= saved.accuracy||character.control;saved.shortGame ??= character.shortGame;saved.putting ??= character.putting;saved.aim ||= "center";saved.lastShotOrigin ||= null;
  saved.position ||= {progress:Math.max(0,1-(saved.distance||holes[saved.hole].yards)/holes[saved.hole].yards),lateral:0};
  saved.greenPosition ||= saved.lie==="green"?greenPointForDistance(saved.distance,"center"):null;
  saved.attackShotsRemaining=Math.max(0,Math.min(ATTACK_SHOT_LIMIT,Number.isFinite(saved.attackShotsRemaining)?saved.attackShotsRemaining:ATTACK_SHOT_LIMIT));
  saved.winds ||= holes.map(()=>+(1+Math.random()*5).toFixed(1));saved.shots ||= Array.from({length:18},()=>[]);return saved;
}
function simulateCpu(skill){return holes.map(h=>{const r=Math.random()+(skill-78)*.045-(h.difficulty-3)*.16;return r>.88?h.par-2:r>.56?h.par-1:r>.17?h.par:r>-.13?h.par+1:h.par+2})}
function loadState(){try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))||JSON.parse(localStorage.getItem("pga-tour-18-save-v4"))||JSON.parse(localStorage.getItem("pga-tour-18-save-v3"))||JSON.parse(localStorage.getItem("pga-tour-18-save-v2"))||JSON.parse(localStorage.getItem("pga-tour-18-save-v1")))}catch{return{started:false}}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function optionsFor(current){
  if(current.lie==="green")return[{id:"putt",name:"パットする",desc:puttDifficultyLabel(current.distance),risk:0,power:1,recommended:true}];
  return[
    {id:"normal",name:"普通に打つ",desc:"標準の飛距離と安定感",risk:0,power:1,recommended:true},
    {id:"attack",name:"攻めて打つ",desc:"飛距離アップ・高リスク",risk:4,power:1.15},
    {id:"layup",name:"刻んで打つ",desc:"安全優先・リスク低",risk:-3,power:.64}
  ];
}
function canUseAttack(current=state){return (current.attackShotsRemaining??ATTACK_SHOT_LIMIT)>0}
function consumeAttackShot(current=state){if(!canUseAttack(current))return false;current.attackShotsRemaining--;return true}
function puttDifficultyLabel(distance){return distance<=1?"ショートパット":distance<=3?"チャンスパット":distance<=6?"ミドルパット":distance<=10?"ロングパット":"超ロングパット"}
function renderCharacterOptions(){
  $("#characterOptions").innerHTML=CHARACTERS.map(character=>`<button class="character-option ${character.id===selectedCharacterId?"selected":""}" data-character="${character.id}"><header><strong>${character.name}</strong><span>${character.tag}</span></header><p>${character.description}</p><div class="character-stats"><span>PWR<b>${character.power}</b></span><span>ACC<b>${character.accuracy}</b></span><span>CTL<b>${character.control}</b></span><span>SG<b>${character.shortGame}</b></span><span>PUTT<b>${character.putting}</b></span></div></button>`).join("");
  $$('[data-character]').forEach(button=>button.onclick=()=>{selectedCharacterId=button.dataset.character;renderCharacterOptions()});
}
function renderAimOptions(){const currentAim=aimById(state.aim);$("#aimLabel").textContent=currentAim.name;$("#aimOptions").innerHTML=AIM_OPTIONS.map(aim=>`<button class="aim-button ${aim.id===state.aim?"selected":""}" data-aim="${aim.id}">${aim.name}</button>`).join("");$$('[data-aim]').forEach(button=>button.onclick=()=>{state.aim=button.dataset.aim;save();render()})}

function resolvePutt(current,opt,timing,rng){
  const d=current.distance,g=timing.grade,putting=current.putting||76;
  let chance=d<=1?({PERFECT:.998,GOOD:.985,NORMAL:.82,MISS:.35,BAD:.05}[g]):d<=3?({PERFECT:.96,GOOD:.82,NORMAL:.46,MISS:.14,BAD:.03}[g]):d<=6?({PERFECT:.84,GOOD:.58,NORMAL:.27,MISS:.08,BAD:.015}[g]):d<=10?({PERFECT:.60,GOOD:.30,NORMAL:.13,MISS:.04,BAD:.01}[g]):({PERFECT:.35,GOOD:.18,NORMAL:.08,MISS:.025,BAD:.006}[g]);
  chance+=(putting-76)*.008;
  current.strokes++;const shotNumber=current.strokes;
  if(rng()<Math.max(.01,Math.min(.995,chance))){return{finished:true,penalty:false,outcome:"cup",title:"カップイン！",text:`${current.strokes}打でホールアウト`,shotNumber}}
  const missScale={PERFECT:.07,GOOD:.12,NORMAL:.24,MISS:.43,BAD:.72}[g];
  const direction=timing.side==="center"?"":timing.side==="left"?"左":"右";current.distance=Math.max(.3,+((d*missScale)+(g==="BAD"?1.2+rng()*2.4:rng()*.8)).toFixed(1));
  const puttSide=timing.side==="left"?-1:timing.side==="right"?1:0;current.position={progress:.98,lateral:puttSide*Math.min(.18,.035+current.distance*.016)};current.greenPosition=greenPointForDistance(current.distance,timing.side,current.greenPosition);
  current.lie="green";return{finished:false,penalty:false,outcome:"green",title:`${direction}に外れる`,text:`返し ${current.distance}m`,shotNumber};
}

function snapshotShotOrigin(current){return{position:{...current.position},greenPosition:current.greenPosition?{...current.greenPosition}:null,lie:current.lie,distance:current.distance,aim:current.aim,hole:current.hole}}
function restoreShotOrigin(current,origin){current.position={...origin.position};current.greenPosition=origin.greenPosition?{...origin.greenPosition}:null;current.lie=origin.lie;current.distance=origin.distance;current.aim=origin.aim}
function lieMultiplierFor(lie,opt,rng=Math.random){const safe=opt.id==="layup",attack=opt.id==="attack";if(lie==="fairway")return .98+rng()*.02;if(lie==="rough")return Math.min(.95,Math.max(.80,.80+rng()*.15+(safe?.03:0)-(attack?.03:0)));if(lie==="bunker")return Math.min(.75,Math.max(.50,.50+rng()*.25+(safe?.025:0)-(attack?.025:0)));return 1}
function finalDirectionFor(current,timing,h){const aim=aimById(current.aim),timingSide=timing.side==="left"?-1:timing.side==="right"?1:0;const lieSpread=current.lie==="bunker"?1.45:current.lie==="rough"?1.17:current.lie==="fairway"?.86:1;const gradeSpread={PERFECT:.015,GOOD:.07,NORMAL:.15,MISS:.31,BAD:.54}[timing.grade];const precision=Math.max(.55,1-(current.accuracy-60)*.009-(current.control-60)*.005);const windDirection=current.hole%2?-1:1;const windDrift=windDirection*(current.winds[current.hole]-1)*.018;const value=Math.max(-1.15,Math.min(1.15,aim.value+timingSide*gradeSpread*lieSpread*precision+windDrift));return{aim,value,side:value<-.14?"left":value>.14?"right":"center",error:Math.abs(value-aim.value)}}
function resolveFullShot(current,opt,timing,rng=Math.random){
  const h=holes[current.hole],wind=current.winds[current.hole],origin=snapshotShotOrigin(current),attacking=opt.id==="attack",layingUp=opt.id==="layup",badLie=current.lie==="rough"||current.lie==="bunker",direction=finalDirectionFor(current,timing,h),sideRisk=direction.side==="left"?h.leftRisk:direction.side==="right"?h.rightRisk:1,obAligned=h.obSide==="both"||h.obSide===direction.side;
  current.lastShotOrigin=origin;current.strokes++;const shotNumber=current.strokes;const largeMiss=timing.grade==="BAD"||(timing.grade==="MISS"&&timing.deviation>=40);const edgeAim=Math.abs(direction.aim.value)>=.5,missTowardAim=(direction.aim.value<0&&timing.side==="left")||(direction.aim.value>0&&timing.side==="right");
  const canOB=attacking&&obAligned&&h.obSide!=="none"&&(largeMiss||edgeAim&&missTowardAim)&&(badLie||wind>=3.5||edgeAim);const obChance=canOB?Math.min(.24,.02+sideRisk*.018+(edgeAim?.035:0)+(wind>=5?.025:0)+(badLie?.03:0)+(timing.grade==="BAD"?.04:0)):0;
  if(rng()<obChance){current.strokes++;const animationPosition={progress:Math.min(.9,origin.position.progress+.12),lateral:direction.side==="left"?-1.05:1.05};restoreShotOrigin(current,origin);return{finished:false,penalty:true,outcome:"ob",direction:direction.side,title:`${direction.side==="left"?"左":"右"}OB`,text:`OB。1罰打を加えて元の位置から打ち直しです。次は${current.strokes+1}打目です。`,shotNumber,animationPosition}}
  const canWater=h.waterRisk>0&&direction.side==="right"&&(largeMiss||edgeAim&&missTowardAim);const waterChance=canWater?Math.min(.24,(.01+h.waterRisk*.018+(attacking?.055:0)+(edgeAim?.025:0))*(layingUp?.25:1)):0;
  if(rng()<waterChance){current.strokes++;const animationPosition={progress:Math.min(.9,origin.position.progress+.15),lateral:Math.max(.55,direction.value)};restoreShotOrigin(current,origin);return{finished:false,penalty:true,outcome:"wh",direction:"right",title:"WH",text:`WH。1罰打を加えて元の位置から打ち直しです。次は${current.strokes+1}打目です。`,shotNumber,animationPosition}}
  const lieMultiplier=lieMultiplierFor(origin.lie,opt,rng),powerMultiplier=.88+(current.power||78)*.0015,windMultiplier=1+((current.hole%2?-1:1)*direction.value*(wind-1)*.008),qualityPower={PERFECT:1.02,GOOD:.98,NORMAL:.91,MISS:.79,BAD:.65}[timing.grade]+((current.control||78)-70)*.001*(timing.grade==="MISS"||timing.grade==="BAD"?1:0),shortGameMultiplier=(origin.distance<=95||origin.lie==="bunker")?.88+(current.shortGame||75)*.0015:1;
  const base=origin.lie==="tee"?(current.power||76)*3.05:Math.min(225,origin.distance*.93),variance=.96+rng()*.08,travel=Math.max(18,base*opt.power*powerMultiplier*lieMultiplier*windMultiplier*qualityPower*shortGameMultiplier*variance);
  current.distance=Math.max(0,Math.round(origin.distance-travel));updatePosition(current,h,direction.value,qualityPower);
  const accuracyBoost=((current.accuracy||76)-76)*.012+((current.control||76)-76)*.006-direction.error*.20-opt.risk*.025-h.difficulty*.018+(layingUp?.08:0),greenRange=(timing.grade==="PERFECT"?28:timing.grade==="GOOD"?22:16)+(attacking&&timing.grade==="PERFECT"?8:0)-(layingUp?4:0),reachedGreenArea=current.distance<=greenRange;
  if(reachedGreenArea&&rng()<Math.max(.08,.72+accuracyBoost)){current.lie="green";const basePutt={PERFECT:1.4,GOOD:3,NORMAL:6,MISS:10,BAD:15}[timing.grade]*(attacking?.72:layingUp?1.35:1);current.distance=+(Math.max(.5,basePutt*(.65+rng()*.7)).toFixed(1));current.position={progress:.98,lateral:direction.value*.12};current.greenPosition=greenPointForDistance(current.distance,direction.side);return{finished:false,penalty:false,outcome:"green",direction:direction.side,title:"グリーンオン",text:`ピンまで ${current.distance}m`,shotNumber}}
  if(reachedGreenArea)current.distance=Math.max(6,Math.round(7+(1-timing.quality)*22+rng()*12));
  const bunkerChance=Math.max(0,(h.bunkerRisk*.035+(timing.grade==="BAD"?.12:timing.grade==="MISS"?.06:0)+(attacking?.05:0))*(layingUp?.45:1)-accuracyBoost*.18+direction.error*.05);if(current.distance<95&&rng()<bunkerChance){current.lie="bunker";return{finished:false,penalty:false,outcome:"bunker",direction:direction.side,title:`${direction.side==="left"?"左":"右"}バンカー`,text:`残り ${current.distance}ヤード`,shotNumber}}
  const roughChance=Math.min(.92,Math.max(.02,.08+sideRisk*.035+direction.error*.32+(badLie?.06:0)+opt.risk*.025-((current.accuracy||76)-70)*.008-(layingUp?.16:0)));if(rng()<roughChance){current.lie="rough";return{finished:false,penalty:false,outcome:"rough",direction:direction.side,title:`${direction.side==="left"?"左":"右"}ラフ`,text:`残り ${current.distance}ヤード`,shotNumber}}
  current.lie="fairway";return{finished:false,penalty:false,outcome:"fairway",direction:direction.side,title:"フェアウェイ",text:`残り ${current.distance}ヤード`,shotNumber};
}
function updatePosition(current,h,direction,power){current.position={progress:Math.max(0,Math.min(.94,1-current.distance/h.yards)),lateral:Math.max(-.9,Math.min(.9,direction*(.82+(1-power)*.18)))}}
function mapPoint(position){return{x:180+(position?.lateral||0)*120,y:205-(position?.progress||0)*178}}
function greenPointForDistance(distance,side="center",previous){const direction=side==="left"?-1:side==="right"?1:(previous?.x<180?-1:previous?.x>180?1:0);const radius=Math.min(82,Math.max(10,distance*8));return{x:180+direction*radius*.72,y:82+radius*.68}}
function lerpPoint(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function quadraticPoint(a,control,b,t){const u=1-t;return{x:u*u*a.x+2*u*t*control.x+t*t*b.x,y:u*u*a.y+2*u*t*control.y+t*t*b.y}}
function easeOut(t){return 1-Math.pow(1-t,3)}
function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function createShotAnimation(fromPosition,toPosition,timing,result,isPutt,greenFrom=null,greenTo=null){
  const greenAnimation=isPutt&&greenFrom&&greenTo;const from=greenAnimation?greenFrom:mapPoint(fromPosition),to=greenAnimation?greenTo:mapPoint(toPosition),side=timing.side==="left"?-1:timing.side==="right"?1:0;
  const bend={PERFECT:0,GOOD:4,NORMAL:9,MISS:16,BAD:26}[timing.grade]*(side||0);
  const runBack=isPutt?0:{fairway:.09,green:.055,rough:.035,bunker:.02,ob:0,penalty:0}[result.outcome]??.03;
  const landing=lerpPoint(to,from,runBack);
  const control={x:(from.x+landing.x)/2+bend,y:isPutt?(from.y+to.y)/2+1:Math.min(from.y,landing.y)-Math.max(22,Math.abs(from.y-landing.y)*.42)};
  return{type:isPutt?"putt":"flight",map:greenAnimation?"green":"course",from,landing,to,control,runBack,duration:isPutt?760:980,flightEnd:isPutt?1:.78,bend};
}
function animateShot(plan,result){
  return new Promise(resolve=>{
    const greenAnimation=plan.map==="green",marker=$(greenAnimation?"#greenBallMarker":"#positionMarker"),trail=$(greenAnimation?"#greenShotTrail":"#shotTrail"),ball=$(greenAnimation?"#greenFlightBall":"#flightBall"),pulse=$(greenAnimation?"#greenCupPulse":"#cupPulse");
    isShotAnimating=true;marker.classList.add("hidden");trail.classList.remove("hidden");ball.classList.remove("hidden");pulse.classList.add("hidden");
    trail.setAttribute("d",`M ${plan.from.x} ${plan.from.y} Q ${plan.control.x} ${plan.control.y} ${plan.landing.x} ${plan.landing.y}`);
    const length=trail.getTotalLength?.()||200;trail.style.strokeDasharray=`${length}`;trail.style.strokeDashoffset=`${length}`;
    const started=performance.now();
    const frame=now=>{
      const progress=Math.min(1,(now-started)/plan.duration);let point;
      if(plan.type==="putt")point=quadraticPoint(plan.from,plan.control,plan.to,easeInOut(progress));
      else if(progress<plan.flightEnd)point=quadraticPoint(plan.from,plan.control,plan.landing,easeOut(progress/plan.flightEnd));
      else point=lerpPoint(plan.landing,plan.to,easeInOut((progress-plan.flightEnd)/(1-plan.flightEnd)));
      ball.setAttribute("transform",`translate(${point.x} ${point.y})`);trail.style.strokeDashoffset=`${length*(1-Math.min(1,progress/(plan.type==="putt"?1:plan.flightEnd)))}`;
      if(progress<1){shotAnimationFrame=requestAnimationFrame(frame);return}
      if(result.outcome==="cup"){pulse.setAttribute("transform",`translate(${plan.to.x} ${plan.to.y})`);pulse.classList.remove("hidden")}
      setTimeout(()=>{ball.classList.add("hidden");trail.classList.add("hidden");pulse.classList.add("hidden");marker.classList.remove("hidden");isShotAnimating=false;resolve()},result.outcome==="cup"?220:90);
    };
    shotAnimationFrame=requestAnimationFrame(frame);
  });
}
function resultComment(opt,timing,result){
  const hit=timing.grade,side=result.direction==="left"?"左":result.direction==="right"?"右":timing.side==="left"?"左":timing.side==="right"?"右":"中央";
  if(opt.id==="putt"){
    if(result.outcome==="cup")return hit==="PERFECT"?"完璧なタッチ。カップイン。":`${hit}のタッチでカップイン。`;
    if(hit==="BAD")return `大きく${side}へ外れ、返しが残る。`;
    return `${hit}のタッチ。返しは${result.text.replace("返し ","")}`;
  }
  if(result.outcome==="ob")return `OB。1罰打を加えて元の位置から打ち直しです。次は${result.nextShot}打目です。`;
  if(result.outcome==="wh")return `WH。1罰打を加えて元の位置から打ち直しです。次は${result.nextShot}打目です。`;
  if(result.outcome==="penalty")return `${hit}のミスで${side}へ。ペナルティです。`;
  if(result.outcome==="bunker")return `${hit}のショットが${side}バンカーへ。`;
  if(result.outcome==="rough")return hit==="MISS"?`少しタイミングが早く、${side}ラフへ。`:`${hit}のミスで${side}ラフへ。`;
  if(result.outcome==="green")return opt.id==="attack"&&hit==="PERFECT"?"完璧なインパクト。ピンそばへ運んだ。":`${hit}のショットでグリーンを捉えた。`;
  if(opt.id==="attack"&&hit==="PERFECT")return "完璧なインパクト。大きく飛んでフェアウェイ中央へ。";
  if(opt.id==="layup"&&(hit==="PERFECT"||hit==="GOOD"))return "安全に運び、フェアウェイをキープ。";
  return `${hit}のショットでフェアウェイをキープ。`;
}
function applyShot(opt,timing,rng=Math.random){
  if(state.complete||isShotAnimating)return;const playedHole=state.hole,wasPutt=state.lie==="green",fromPosition={...state.position},fromGreen=wasPutt?{...(state.greenPosition||greenPointForDistance(state.distance,"center"))}:null;
  if(wasPutt)state.lastShotOrigin=snapshotShotOrigin(state);
  if(opt.id==="attack"&&!consumeAttackShot()){showToast("「攻めて打つ」はこのラウンドでは使い切りました。");$(".action-panel").classList.remove("hidden");return}
  const result=state.lie==="green"?resolvePutt(state,opt,timing,rng):resolveFullShot(state,opt,timing,rng);
  const toPosition=result.animationPosition||(result.finished?{progress:.98,lateral:0}:{...state.position}),toGreen=wasPutt?(result.finished?{x:180,y:82}:{...(state.greenPosition||greenPointForDistance(state.distance,"center"))}):null;
  const willPickup=!result.finished&&state.strokes>=holes[playedHole].par+6;
  if(willPickup){result.title="ピックアップ";result.text="最大スコアでホールアウト";result.outcome="penalty"}
  result.nextShot=state.strokes+1;const log={stroke:result.shotNumber,type:"shot",choice:opt.name,aim:state.aim,timing:{grade:timing.grade,deviation:+timing.deviation.toFixed(1),side:timing.side},outcome:result.outcome,title:result.title,text:result.text,origin:state.lastShotOrigin};state.shots[playedHole].push(log);
  if(result.penalty)state.shots[playedHole].push({stroke:result.shotNumber+1,type:"penalty",choice:"1打罰",outcome:result.outcome,title:"ペナルティ",text:result.text});
  const plan=createShotAnimation(fromPosition,toPosition,timing,result,wasPutt,fromGreen,toGreen);
  animateShot(plan,result).then(()=>{
    if(result.finished)finishHole();else if(willPickup)finishHole(holes[playedHole].par+6);
    result.comment=resultComment(opt,timing,result);save();render();showResult(opt,timing,result);$(".action-panel").classList.remove("hidden");
  });
}
function finishHole(forced){const idx=state.hole;state.scores[idx]=forced||state.strokes;if(idx===17){state.complete=true;setTimeout(showFinal,500);return}state.hole++;state.strokes=0;state.lie="tee";state.distance=holes[state.hole].yards;state.position={progress:0,lateral:0};state.greenPosition=null;state.lastShotOrigin=null}

function paintTimingBar(profile){
  const widths=[(100-profile.miss)/2,(profile.miss-profile.normal)/2,(profile.normal-profile.good)/2,(profile.good-profile.perfect)/2,profile.perfect,(profile.good-profile.perfect)/2,(profile.normal-profile.good)/2,(profile.miss-profile.normal)/2,(100-profile.miss)/2];
  const classes=["bad","miss","normal","good","perfect","good","normal","miss","bad"];
  $$("#timingZones i").forEach((zone,i)=>{zone.style.flex=`0 0 ${widths[i]}%`;zone.className=`zone-${classes[i]}`});
  $("#timingBar").dataset.profile=profile.key;$("#timingCenterLabel").textContent=`PERFECT ±${profile.perfect}%`;
}
function selectShot(opt){if(opt.id==="attack"&&!canUseAttack()){showToast("「攻めて打つ」はこのラウンドでは使い切りました。");return}pendingShot=opt;pendingTimingProfile=timingProfileFor(opt,state);paintTimingBar(pendingTimingProfile);$("#timingShotName").textContent=opt.name;$("#timingGrade").textContent=`${pendingTimingProfile.label} · CENTERを狙え`;$("#timingGrade").className="timing-grade";$("#timingPanel").classList.remove("hidden");$(".action-panel").classList.add("hidden");timingStart=performance.now();cancelAnimationFrame(timingFrame);animateTiming(timingStart);setTimeout(()=>$("#swingButton").scrollIntoView({behavior:"smooth",block:"center"}),80)}
function animateTiming(now){const elapsed=(now-timingStart)%1300,phase=elapsed/1300;timingPosition=phase<.5?phase*200:(1-phase)*200;$("#timingCursor").style.left=`${timingPosition}%`;timingFrame=requestAnimationFrame(animateTiming)}
function stopTiming(){if(!pendingShot)return;cancelAnimationFrame(timingFrame);const timing=timingResult(timingPosition,pendingTimingProfile);$("#timingGrade").textContent=timing.label;$("#timingGrade").className=`timing-grade grade-${timing.grade.toLowerCase()}`;const opt=pendingShot;pendingShot=null;pendingTimingProfile=null;$("#swingButton").disabled=true;setTimeout(()=>{$("#timingPanel").classList.add("hidden");applyShot(opt,timing);$("#swingButton").disabled=false},380)}
function cancelTiming(){cancelAnimationFrame(timingFrame);pendingShot=null;pendingTimingProfile=null;$("#timingPanel").classList.add("hidden");$(".action-panel").classList.remove("hidden")}

function parThrough(n){return holes.slice(0,n).reduce((a,h)=>a+h.par,0)}
function playerTotal(n=18){return state.scores.slice(0,n).reduce((a,s)=>a+(s||0),0)}
function relative(total,par){const d=total-par;return d===0?"E":d>0?`+${d}`:`${d}`}
function scoreClass(v){return v<0?"score-under":v>0?"score-over":"score-even"}
function completedHoles(){return state.scores.filter(Number.isFinite).length}
function cpuScoreAt(cpu,thru){return cpu.scores.slice(0,thru).reduce((a,b)=>a+b,0)-parThrough(thru)}
function setScoreEl(el,n){el.textContent=relative(n,0);el.className=scoreClass(n)}
function formatRank(n){return n<=3?["1st","2nd","3rd"][n-1]:`T${n}`}
function getRanking(){const thru=completedHoles();return[...state.cpu.map(c=>({name:c.name,rel:cpuScoreAt(c,thru),thru:state.complete?"F":thru,country:c.country})),{name:state.name,rel:playerTotal(thru)-parThrough(thru),thru:state.complete?"F":thru,country:"YOU",player:true}].sort((a,b)=>a.rel-b.rel)}
function showResult(opt,timing,result){clearTimeout(resultTimer);$("#resultTitle").textContent=`${opt.name} × ${timing.grade}`;$("#resultText").textContent=result.comment;$("#resultIcon").textContent=result.outcome==="cup"?"◆":result.outcome==="ob"||result.outcome==="wh"||result.outcome==="penalty"?"!":"●";$("#resultBanner").classList.remove("hidden");resultTimer=setTimeout(()=>$("#resultBanner").classList.add("hidden"),3200)}
function showToast(message){document.querySelector(".toast")?.remove();const toast=document.createElement("div");toast.className="toast";toast.textContent=message;document.body.append(toast);setTimeout(()=>toast.remove(),2500)}

function renderCourse(h){
  const onGreen=state.lie==="green";$("#courseMap").classList.toggle("hidden",onGreen);$("#greenView").classList.toggle("hidden",!onGreen);$("#courseVisual").classList.toggle("green-active",onGreen);
  if(onGreen){renderGreen(h);return}
  const progress=state.position?.progress||0,lateral=state.position?.lateral||0,x=180+lateral*120,y=205-progress*178;
  const aim=aimById(state.aim),aimEndX=Math.max(22,Math.min(338,x+aim.value*55)),aimEndY=Math.max(18,y-47);$("#positionMarker").setAttribute("transform",`translate(${x} ${y})`);$("#aimLine").setAttribute("d",`M ${x} ${y} L ${aimEndX} ${aimEndY}`);$("#waterFeature").classList.toggle("hidden",h.waterRisk===0);$("#leftBunker").classList.toggle("hidden",h.bunkerRisk<3);$("#rightBunker").classList.toggle("hidden",h.bunkerRisk<2);$("#obLeft").classList.toggle("hidden",!['left','both'].includes(h.obSide));$("#obRight").classList.toggle("hidden",!['right','both'].includes(h.obSide));
  $("#fairwayPath").setAttribute("d",h.leftRisk>h.rightRisk?"M198 220 C235 170 125 143 189 101 C225 74 171 48 180 20":h.rightRisk>h.leftRisk?"M158 220 C120 170 220 146 176 104 C135 64 192 48 180 20":"M180 220 C135 170 225 143 180 104 C145 67 207 50 180 20");
  $("#windPill").textContent=`WIND ${state.winds[state.hole]}m/s ${state.hole%2?"←":"→"}`;
}
function renderGreen(h){
  state.greenPosition ||= greenPointForDistance(state.distance,"center");const ball=state.greenPosition,cup={x:180,y:82},slope=h.leftRisk>h.rightRisk?"LEFT → RIGHT":h.rightRisk>h.leftRisk?"RIGHT → LEFT":"DOWNHILL";
  $("#greenBallMarker").setAttribute("transform",`translate(${ball.x} ${ball.y})`);$("#greenPuttLine").setAttribute("d",`M ${ball.x} ${ball.y} Q ${(ball.x+cup.x)/2+(h.leftRisk-h.rightRisk)*4} ${(ball.y+cup.y)/2-10} ${cup.x} ${cup.y}`);
  $("#greenDistance").textContent=`${Number(state.distance).toFixed(1)}m`;$("#greenHoleNumber").textContent=h.number;$("#greenStrokes").textContent=state.strokes;$("#greenSlopeText").textContent=`${slope} ${(1.2+h.difficulty*.25).toFixed(1)}°`;
}
function render(){
  $("#startPanel").classList.toggle("hidden",state.started);$("#gamePanel").classList.toggle("hidden",!state.started);if(!state.started){renderCharacterOptions();renderEmptyScore();return}
  const h=holes[state.hole],thru=completedHoles(),pRel=playerTotal(thru)-parThrough(thru),ranking=getRanking();$("#playerPosition").textContent=formatRank(ranking.findIndex(x=>x.player)+1);setScoreEl($("#liveScore"),pRel);$("#thruValue").textContent=state.complete?"F":thru||"—";
  $("#holeNumber").textContent=h.number;$("#holePar").textContent=`PAR ${h.par}`;$("#holeYards").textContent=`${h.yards} YDS`;$("#difficultyLabel").textContent=["EASY","FAIR","STANDARD","TOUGH","HARD"][h.difficulty-1];$("#shotNumber").textContent=state.strokes+1;
  $("#lieValue").textContent={tee:"TEE",fairway:"FAIRWAY",rough:"ROUGH",bunker:"BUNKER",green:"GREEN"}[state.lie];$("#distanceValue").textContent=state.lie==="green"?`${state.distance}m`:`${state.distance}y`;$("#distancePill").textContent=`${state.distance} ${state.lie==="green"?"M":"YDS"}`;$("#abilityText").textContent=`POWER ${state.power} · ACCURACY ${state.accuracy} · CONTROL ${state.control}`;$("#characterStatus").textContent=`PLAYER · ${state.characterName}`;renderCourse(h);
  const attacks=state.attackShotsRemaining,opts=optionsFor(state);$("#attackCounter").innerHTML=`攻め残り <b>${attacks}</b> / ${ATTACK_SHOT_LIMIT}`;$("#attackCounter").classList.toggle("hidden",state.lie==="green");$("#aimPanel").classList.toggle("hidden",state.lie==="green");if(state.lie!=="green")renderAimOptions();$(".section-title span").textContent=state.lie==="green"?"PUTT":"SELECT SHOT";
  $("#shotOptions").innerHTML=opts.map((o,i)=>{const unavailable=o.id==="attack"&&attacks<=0;const detail=o.id==="attack"?`${o.desc} · 残り${attacks}回`:o.desc;return`<button class="shot-button ${o.recommended?"recommended":""} ${unavailable?"unavailable":""}" data-shot="${i}" aria-disabled="${unavailable}"><strong>${o.name}</strong><span>${detail}</span></button>`}).join("");$$('[data-shot]').forEach((b,i)=>b.onclick=()=>selectShot(opts[i]));renderScorecard();renderRanking();
}
function renderRanking(){const list=getRanking();$("#rankingList").innerHTML=list.map((r,i)=>`<div class="ranking-row ${r.player?"player":""}"><div class="rank-pos">${formatRank(i+1)}</div><div class="rank-name">${r.name}<small>${r.player?"PLAYER":"CPU"} · ${r.country}</small></div><div class="rank-thru">${r.thru||"—"}</div><div class="rank-total ${scoreClass(r.rel)}">${relative(r.rel,0)}</div></div>`).join("")}
function renderScorecard(){const out=state.scores.slice(0,9).filter(Number.isFinite),inn=state.scores.slice(9).filter(Number.isFinite),total=playerTotal(),done=completedHoles();$("#scorecardName").textContent=state.name;$("#outScore").textContent=out.length===9?out.reduce((a,b)=>a+b,0):"—";$("#inScore").textContent=inn.length===9?inn.reduce((a,b)=>a+b,0):"—";$("#totalScore").textContent=done?total:"—";setScoreEl($("#scoreToPar"),total-parThrough(done));const makeNine=start=>{const hs=holes.slice(start,start+9);return`<thead><tr><th>HOLE</th>${hs.map(h=>`<th>${h.number}</th>`).join("")}<th class="nine-total">${start?"IN":"OUT"}</th></tr></thead><tbody><tr><td>PAR</td>${hs.map(h=>`<td>${h.par}</td>`).join("")}<td class="nine-total">${hs.reduce((a,h)=>a+h.par,0)}</td></tr><tr><td>SCORE</td>${hs.map(h=>{const s=state.scores[h.number-1];if(!Number.isFinite(s))return"<td>—</td>";const d=s-h.par;return`<td class="score-cell"><span class="${d<0?"under":d>0?"over":"even"}">${s}</span></td>`}).join("")}<td class="nine-total">${state.scores.slice(start,start+9).every(Number.isFinite)?state.scores.slice(start,start+9).reduce((a,b)=>a+b,0):"—"}</td></tr></tbody>`};$("#scorecardTable").innerHTML=makeNine(0)+makeNine(9)}
function renderEmptyScore(){$("#scorecardTable").innerHTML="";["#outScore","#inScore","#totalScore"].forEach(x=>$(x).textContent="—");$("#scoreToPar").textContent="E";$("#rankingList").innerHTML='<div class="ranking-row"><div>—</div><div class="rank-name">ラウンド開始前<small>PLAYタブから開始してください</small></div></div>'}
function switchView(name){cancelTiming();$$('[data-view]').forEach(t=>t.classList.toggle("active",t.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle("active",v.id===`${name}View`));window.scrollTo(0,0)}
function startGame(){state=freshState($("#playerNameInput").value,selectedCharacterId);save();render()}
function resetGame(){if(!state.started||confirm("現在のラウンドを終了して、新しく始めますか？")){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem("pga-tour-18-save-v4");localStorage.removeItem("pga-tour-18-save-v3");localStorage.removeItem("pga-tour-18-save-v2");localStorage.removeItem("pga-tour-18-save-v1");state={started:false};switchView("play");render()}}
function showFinal(){const rank=getRanking().findIndex(x=>x.player)+1,rel=playerTotal()-parThrough(18);$("#finalPosition").textContent=formatRank(rank);$("#finalScore").textContent=relative(rel,0);$("#finalScore").className=scoreClass(rel);$("#modalBackdrop").classList.remove("hidden")}

globalThis.PGAEngine={holes,ATTACK_SHOT_LIMIT,CHARACTERS,AIM_OPTIONS,TIMING_PROFILES,characterById,aimById,timingProfileFor,timingResult,freshState,migrate,optionsFor,canUseAttack,consumeAttackShot,puttDifficultyLabel,lieMultiplierFor,finalDirectionFor,snapshotShotOrigin,restoreShotOrigin,resolveFullShot,resolvePutt,updatePosition,mapPoint,greenPointForDistance,quadraticPoint,createShotAnimation,resultComment};
$$('[data-view]').forEach(t=>t.onclick=()=>switchView(t.dataset.view));$("#startButton").onclick=startGame;$("#newGameButton").onclick=resetGame;$("#swingButton").onclick=stopTiming;$("#cancelTimingButton").onclick=cancelTiming;$("#viewRankingButton").onclick=()=>{$("#modalBackdrop").classList.add("hidden");switchView("ranking")};$("#closeModalButton").onclick=()=>{$("#modalBackdrop").classList.add("hidden");switchView("score")};if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});render();
