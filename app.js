"use strict";

const STORAGE_KEY = "pga-tour-18-save-v2";
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
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state=loadState(), resultTimer, timingFrame, timingStart=0, timingPosition=0, pendingShot=null;

function timingResult(position){
  const deviation=Math.abs(position-50)*2,side=position<50?"left":position>50?"right":"center";
  const grade=deviation<=5?"PERFECT":deviation<=15?"GOOD":deviation<=30?"NORMAL":deviation<=45?"MISS":"BAD";
  return{position,deviation,side,grade,...GRADE_INFO[grade]};
}
function freshState(name="PLAYER"){
  const cpu=cpuNames.map((name,i)=>{const skill=69+Math.floor(Math.random()*22);return{name,skill,scores:simulateCpu(skill),country:["USA","JPN","KOR","ENG","NOR","AUS","SWE"][i%7]}});
  return{version:2,started:true,complete:false,name:name.trim().toUpperCase()||"PLAYER",power:72+Math.floor(Math.random()*12),accuracy:72+Math.floor(Math.random()*12),putting:70+Math.floor(Math.random()*14),hole:0,strokes:0,lie:"tee",distance:holes[0].yards,position:{progress:0,lateral:0},winds:holes.map(()=>+(1+Math.random()*5).toFixed(1)),scores:Array(18).fill(null),shots:Array.from({length:18},()=>[]),cpu};
}
function migrate(saved){
  if(!saved?.started)return saved||{started:false};
  saved.version=2;saved.position ||= {progress:Math.max(0,1-(saved.distance||holes[saved.hole].yards)/holes[saved.hole].yards),lateral:0};
  saved.winds ||= holes.map(()=>+(1+Math.random()*5).toFixed(1));saved.shots ||= Array.from({length:18},()=>[]);return saved;
}
function simulateCpu(skill){return holes.map(h=>{const r=Math.random()+(skill-78)*.045-(h.difficulty-3)*.16;return r>.88?h.par-2:r>.56?h.par-1:r>.17?h.par:r>-.13?h.par+1:h.par+2})}
function loadState(){try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))||JSON.parse(localStorage.getItem("pga-tour-18-save-v1")))}catch{return{started:false}}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function optionsFor(current){
  const d=current.distance,lie=current.lie;
  if(lie==="green")return[{id:"putt",name:"パットする",desc:d<5?"カップへまっすぐ":"距離感を合わせる",risk:0,power:1,recommended:true},{id:"attackPutt",name:"強気のパット",desc:"決めにいく・返しが残る",risk:2,power:1.25},{id:"lag",name:"寄せる",desc:"3パットを避ける",risk:-2,power:.82}];
  if(d<=55)return[{id:"pin",name:"ピンを狙う",desc:"高い球で寄せる",risk:2,power:1,recommended:true},{id:"center",name:"センター狙い",desc:"確実にグリーンへ",risk:-1,power:.95},{id:"run",name:"転がす",desc:"ミス幅を抑える",risk:0,power:.85}];
  if(lie==="bunker")return[{id:"escape",name:"脱出を優先",desc:"安全にフェアウェイへ",risk:-2,power:.65,recommended:true},{id:"pin",name:"ピンを狙う",desc:"難しいリカバリー",risk:4,power:1}];
  if(lie==="rough")return[{id:"safe",name:"安全に打つ",desc:"フェアウェイへ戻す",risk:-2,power:.65,recommended:true},{id:"pin",name:"ピンを狙う",desc:"ラフから直接狙う",risk:4,power:1},{id:"layup",name:"刻む",desc:"得意距離を残す",risk:-1,power:.55}];
  if(d>260)return[{id:"attack",name:"攻める",desc:"飛距離重視・高リスク",risk:4,power:1.12},{id:"safe",name:"安全に打つ",desc:"フェアウェイを優先",risk:-1,power:.88,recommended:true},{id:"layup",name:"刻む",desc:"次打の位置を作る",risk:-2,power:.65}];
  return[{id:"pin",name:"ピンを狙う",desc:"バーディーチャンスへ",risk:3,power:1.03,recommended:d<175},{id:"center",name:"センター狙い",desc:"グリーン中央へ",risk:-1,power:.96,recommended:d>=175},{id:"layup",name:"刻む",desc:"ハザードを避ける",risk:-2,power:.58}];
}

function resolvePutt(current,opt,timing,rng){
  const d=current.distance,g=timing.grade,putting=current.putting||76;
  let chance=d<=1?({PERFECT:.995,GOOD:.97,NORMAL:.72,MISS:.28,BAD:.08}[g]):d<=3?({PERFECT:.94,GOOD:.79,NORMAL:.4,MISS:.13,BAD:.025}[g]):d<5?({PERFECT:.84,GOOD:.62,NORMAL:.28,MISS:.09,BAD:.015}[g]):Math.max(.025,({PERFECT:.7,GOOD:.42,NORMAL:.18,MISS:.055,BAD:.01}[g])-d*.018);
  chance+=(putting-76)*.008;if(opt.id==="attackPutt")chance+=.035;if(opt.id==="lag")chance-=.08;
  current.strokes++;const shotNumber=current.strokes;
  if(rng()<Math.max(.01,Math.min(.995,chance))){return{finished:true,penalty:false,outcome:"cup",title:"カップイン！",text:`${current.strokes}打でホールアウト`,shotNumber}}
  const missScale={PERFECT:.07,GOOD:.12,NORMAL:.24,MISS:.43,BAD:.72}[g];
  const direction=timing.side==="center"?"":timing.side==="left"?"左":"右";current.distance=Math.max(.3,+((d*missScale)+(g==="BAD"?1.2+rng()*2.4:rng()*.8)).toFixed(1));
  current.lie="green";return{finished:false,penalty:false,outcome:"green",title:`${direction}に外れる`,text:`返し ${current.distance}m`,shotNumber};
}

function resolveFullShot(current,opt,timing,rng=Math.random){
  const h=holes[current.hole],wind=current.winds[current.hole],badLie=current.lie==="rough"||current.lie==="bunker";
  const sideRisk=timing.side==="left"?h.leftRisk:h.rightRisk,obAligned=h.obSide==="both"||h.obSide===timing.side;
  current.strokes++;const shotNumber=current.strokes;let penalty=false;
  const largeMiss=timing.grade==="BAD"||(timing.grade==="MISS"&&timing.deviation>=40);
  const canOB=largeMiss&&opt.id==="attack"&&obAligned&&h.obSide!=="none"&&(badLie||wind>=3.5);
  const obChance=canOB?Math.min(.16,.025+sideRisk*.014+(wind>=5?.025:0)+(badLie?.025:0)):0;
  if(rng()<obChance){current.strokes++;current.lie="tee";current.distance=Math.min(h.yards,current.distance+5);current.position={progress:0,lateral:timing.side==="left"?-.9:.9};return{finished:false,penalty:true,outcome:"ob",title:`${timing.side==="left"?"左":"右"}OB`,text:"1打罰・打ち直し",shotNumber}}
  const waterChance=largeMiss&&h.waterRisk>0&&timing.side==="right"?Math.min(.18,.025+h.waterRisk*.022+(opt.risk>2?.025:0)):0;
  if(rng()<waterChance){current.strokes++;penalty=true;current.lie="rough";current.distance=Math.max(40,Math.round(current.distance*.55));updatePosition(current,h,timing,.75);return{finished:false,penalty,outcome:"penalty",title:"池・ペナルティ",text:`1打罰・残り${current.distance}ヤード`,shotNumber}}
  const liePower=current.lie==="bunker"?.62:current.lie==="rough"?.83:1;
  const qualityPower={PERFECT:1.02,GOOD:.98,NORMAL:.91,MISS:.79,BAD:.65}[timing.grade];
  const base=current.lie==="tee"?(current.power||76)*3.05:Math.min(225,current.distance*.93);
  const variance=.96+rng()*.08,travel=Math.max(18,base*opt.power*liePower*qualityPower*variance);
  current.distance=Math.max(0,Math.round(current.distance-travel));updatePosition(current,h,timing,qualityPower);
  const accuracyBoost=((current.accuracy||76)-76)*.012-timing.deviation*.008-opt.risk*.025-h.difficulty*.018;
  const greenRange=timing.grade==="PERFECT"?28:timing.grade==="GOOD"?22:16;
  const reachedGreenArea=current.distance<=greenRange;
  if(reachedGreenArea&&rng()<Math.max(.08,.72+accuracyBoost)){
    current.lie="green";const basePutt={PERFECT:1.4,GOOD:3,NORMAL:6,MISS:10,BAD:15}[timing.grade];current.distance=+(Math.max(.5,basePutt*(.65+rng()*.7)).toFixed(1));current.position={progress:.98,lateral:timing.side==="left"?-.12:.12};return{finished:false,penalty,outcome:"green",title:"グリーンオン",text:`ピンまで ${current.distance}m`,shotNumber};
  }
  if(reachedGreenArea)current.distance=Math.max(6,Math.round(7+(1-timing.quality)*22+rng()*12));
  const bunkerChance=Math.max(0,h.bunkerRisk*.035+(timing.grade==="BAD"?.12:timing.grade==="MISS"?.06:0)-accuracyBoost*.18);
  if(current.distance<95&&rng()<bunkerChance){current.lie="bunker";return{finished:false,penalty,outcome:"bunker",title:`${timing.side==="left"?"左":"右"}バンカー`,text:`残り ${current.distance}ヤード`,shotNumber}}
  const roughChance=Math.min(.92,.08+sideRisk*.035+timing.deviation*.009+(badLie?.06:0)+opt.risk*.025-((current.accuracy||76)-70)*.008);
  if(rng()<roughChance){current.lie="rough";return{finished:false,penalty,outcome:"rough",title:`${timing.side==="left"?"左":"右"}ラフ`,text:`残り ${current.distance}ヤード`,shotNumber}}
  current.lie="fairway";return{finished:false,penalty,outcome:"fairway",title:"フェアウェイ",text:`残り ${current.distance}ヤード`,shotNumber};
}
function updatePosition(current,h,timing,power){current.position={progress:Math.max(0,Math.min(.94,1-current.distance/h.yards)),lateral:timing.side==="center"?0:(timing.side==="left"?-1:1)*Math.min(.85,timing.deviation/100*(1.25-power*.25))}}
function applyShot(opt,timing,rng=Math.random){
  if(state.complete)return;const playedHole=state.hole;
  const result=state.lie==="green"?resolvePutt(state,opt,timing,rng):resolveFullShot(state,opt,timing,rng);
  const log={stroke:result.shotNumber,type:"shot",choice:opt.name,timing:{grade:timing.grade,deviation:+timing.deviation.toFixed(1),side:timing.side},outcome:result.outcome,title:result.title,text:result.text};state.shots[playedHole].push(log);
  if(result.penalty)state.shots[playedHole].push({stroke:result.shotNumber+1,type:"penalty",choice:"1打罰",outcome:result.outcome,title:"ペナルティ",text:result.text});
  if(result.finished)finishHole();else if(state.strokes>=holes[playedHole].par+6){result.title="ピックアップ";result.text="最大スコアでホールアウト";result.outcome="penalty";finishHole(holes[playedHole].par+6)}
  save();render();showResult(timing.label,result.title,result.text,result.outcome);
}
function finishHole(forced){const idx=state.hole;state.scores[idx]=forced||state.strokes;if(idx===17){state.complete=true;setTimeout(showFinal,500);return}state.hole++;state.strokes=0;state.lie="tee";state.distance=holes[state.hole].yards;state.position={progress:0,lateral:0}}

function selectShot(opt){pendingShot=opt;$("#timingShotName").textContent=opt.name;$("#timingGrade").textContent="CENTERを狙え";$("#timingGrade").className="timing-grade";$("#timingPanel").classList.remove("hidden");$(".action-panel").classList.add("hidden");timingStart=performance.now();cancelAnimationFrame(timingFrame);animateTiming(timingStart);setTimeout(()=>$("#swingButton").scrollIntoView({behavior:"smooth",block:"center"}),80)}
function animateTiming(now){const elapsed=(now-timingStart)%1300,phase=elapsed/1300;timingPosition=phase<.5?phase*200:(1-phase)*200;$("#timingCursor").style.left=`${timingPosition}%`;timingFrame=requestAnimationFrame(animateTiming)}
function stopTiming(){if(!pendingShot)return;cancelAnimationFrame(timingFrame);const timing=timingResult(timingPosition);$("#timingGrade").textContent=timing.label;$("#timingGrade").className=`timing-grade grade-${timing.grade.toLowerCase()}`;const opt=pendingShot;pendingShot=null;$("#swingButton").disabled=true;setTimeout(()=>{applyShot(opt,timing);$("#timingPanel").classList.add("hidden");$(".action-panel").classList.remove("hidden");$("#swingButton").disabled=false},380)}
function cancelTiming(){cancelAnimationFrame(timingFrame);pendingShot=null;$("#timingPanel").classList.add("hidden");$(".action-panel").classList.remove("hidden")}

function parThrough(n){return holes.slice(0,n).reduce((a,h)=>a+h.par,0)}
function playerTotal(n=18){return state.scores.slice(0,n).reduce((a,s)=>a+(s||0),0)}
function relative(total,par){const d=total-par;return d===0?"E":d>0?`+${d}`:`${d}`}
function scoreClass(v){return v<0?"score-under":v>0?"score-over":"score-even"}
function completedHoles(){return state.scores.filter(Number.isFinite).length}
function cpuScoreAt(cpu,thru){return cpu.scores.slice(0,thru).reduce((a,b)=>a+b,0)-parThrough(thru)}
function setScoreEl(el,n){el.textContent=relative(n,0);el.className=scoreClass(n)}
function formatRank(n){return n<=3?["1st","2nd","3rd"][n-1]:`T${n}`}
function getRanking(){const thru=completedHoles();return[...state.cpu.map(c=>({name:c.name,rel:cpuScoreAt(c,thru),thru:state.complete?"F":thru,country:c.country})),{name:state.name,rel:playerTotal(thru)-parThrough(thru),thru:state.complete?"F":thru,country:"YOU",player:true}].sort((a,b)=>a.rel-b.rel)}
function showResult(grade,title,text,outcome){clearTimeout(resultTimer);$("#resultTitle").textContent=`${grade} · ${title}`;$("#resultText").textContent=text;$("#resultIcon").textContent=outcome==="cup"?"◆":outcome==="ob"||outcome==="penalty"?"!":"●";$("#resultBanner").classList.remove("hidden");resultTimer=setTimeout(()=>$("#resultBanner").classList.add("hidden"),3000)}

function renderCourse(h){
  const progress=state.position?.progress||0,lateral=state.position?.lateral||0,x=180+lateral*120,y=205-progress*178;
  $("#positionMarker").setAttribute("transform",`translate(${x} ${y})`);$("#waterFeature").classList.toggle("hidden",h.waterRisk===0);$("#leftBunker").classList.toggle("hidden",h.bunkerRisk<3);$("#rightBunker").classList.toggle("hidden",h.bunkerRisk<2);$("#obLeft").classList.toggle("hidden",!['left','both'].includes(h.obSide));$("#obRight").classList.toggle("hidden",!['right','both'].includes(h.obSide));
  $("#fairwayPath").setAttribute("d",h.leftRisk>h.rightRisk?"M198 220 C235 170 125 143 189 101 C225 74 171 48 180 20":h.rightRisk>h.leftRisk?"M158 220 C120 170 220 146 176 104 C135 64 192 48 180 20":"M180 220 C135 170 225 143 180 104 C145 67 207 50 180 20");
  $("#windPill").textContent=`WIND ${state.winds[state.hole]}m/s ${state.hole%2?"←":"→"}`;
}
function render(){
  $("#startPanel").classList.toggle("hidden",state.started);$("#gamePanel").classList.toggle("hidden",!state.started);if(!state.started){renderEmptyScore();return}
  const h=holes[state.hole],thru=completedHoles(),pRel=playerTotal(thru)-parThrough(thru),ranking=getRanking();$("#playerPosition").textContent=formatRank(ranking.findIndex(x=>x.player)+1);setScoreEl($("#liveScore"),pRel);$("#thruValue").textContent=state.complete?"F":thru||"—";
  $("#holeNumber").textContent=h.number;$("#holePar").textContent=`PAR ${h.par}`;$("#holeYards").textContent=`${h.yards} YDS`;$("#difficultyLabel").textContent=["EASY","FAIR","STANDARD","TOUGH","HARD"][h.difficulty-1];$("#shotNumber").textContent=state.strokes+1;
  $("#lieValue").textContent={tee:"TEE",fairway:"FAIRWAY",rough:"ROUGH",bunker:"BUNKER",green:"GREEN"}[state.lie];$("#distanceValue").textContent=state.lie==="green"?`${state.distance}m`:`${state.distance}y`;$("#distancePill").textContent=`${state.distance} ${state.lie==="green"?"M":"YDS"}`;$("#abilityText").textContent=`POWER ${state.power} · ACCURACY ${state.accuracy}`;renderCourse(h);
  const opts=optionsFor(state);$("#shotOptions").innerHTML=opts.map((o,i)=>`<button class="shot-button ${o.recommended?"recommended":""}" data-shot="${i}"><strong>${o.name}</strong><span>${o.desc}</span></button>`).join("");$$('[data-shot]').forEach((b,i)=>b.onclick=()=>selectShot(opts[i]));renderScorecard();renderRanking();
}
function renderRanking(){const list=getRanking();$("#rankingList").innerHTML=list.map((r,i)=>`<div class="ranking-row ${r.player?"player":""}"><div class="rank-pos">${formatRank(i+1)}</div><div class="rank-name">${r.name}<small>${r.player?"PLAYER":"CPU"} · ${r.country}</small></div><div class="rank-thru">${r.thru||"—"}</div><div class="rank-total ${scoreClass(r.rel)}">${relative(r.rel,0)}</div></div>`).join("")}
function renderScorecard(){const out=state.scores.slice(0,9).filter(Number.isFinite),inn=state.scores.slice(9).filter(Number.isFinite),total=playerTotal(),done=completedHoles();$("#scorecardName").textContent=state.name;$("#outScore").textContent=out.length===9?out.reduce((a,b)=>a+b,0):"—";$("#inScore").textContent=inn.length===9?inn.reduce((a,b)=>a+b,0):"—";$("#totalScore").textContent=done?total:"—";setScoreEl($("#scoreToPar"),total-parThrough(done));const makeNine=start=>{const hs=holes.slice(start,start+9);return`<thead><tr><th>HOLE</th>${hs.map(h=>`<th>${h.number}</th>`).join("")}<th class="nine-total">${start?"IN":"OUT"}</th></tr></thead><tbody><tr><td>PAR</td>${hs.map(h=>`<td>${h.par}</td>`).join("")}<td class="nine-total">${hs.reduce((a,h)=>a+h.par,0)}</td></tr><tr><td>SCORE</td>${hs.map(h=>{const s=state.scores[h.number-1];if(!Number.isFinite(s))return"<td>—</td>";const d=s-h.par;return`<td class="score-cell"><span class="${d<0?"under":d>0?"over":"even"}">${s}</span></td>`}).join("")}<td class="nine-total">${state.scores.slice(start,start+9).every(Number.isFinite)?state.scores.slice(start,start+9).reduce((a,b)=>a+b,0):"—"}</td></tr></tbody>`};$("#scorecardTable").innerHTML=makeNine(0)+makeNine(9)}
function renderEmptyScore(){$("#scorecardTable").innerHTML="";["#outScore","#inScore","#totalScore"].forEach(x=>$(x).textContent="—");$("#scoreToPar").textContent="E";$("#rankingList").innerHTML='<div class="ranking-row"><div>—</div><div class="rank-name">ラウンド開始前<small>PLAYタブから開始してください</small></div></div>'}
function switchView(name){cancelTiming();$$('[data-view]').forEach(t=>t.classList.toggle("active",t.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle("active",v.id===`${name}View`));window.scrollTo(0,0)}
function startGame(){state=freshState($("#playerNameInput").value);save();render()}
function resetGame(){if(!state.started||confirm("現在のラウンドを終了して、新しく始めますか？")){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem("pga-tour-18-save-v1");state={started:false};switchView("play");render()}}
function showFinal(){const rank=getRanking().findIndex(x=>x.player)+1,rel=playerTotal()-parThrough(18);$("#finalPosition").textContent=formatRank(rank);$("#finalScore").textContent=relative(rel,0);$("#finalScore").className=scoreClass(rel);$("#modalBackdrop").classList.remove("hidden")}

globalThis.PGAEngine={holes,timingResult,freshState,optionsFor,resolveFullShot,resolvePutt,updatePosition};
$$('[data-view]').forEach(t=>t.onclick=()=>switchView(t.dataset.view));$("#startButton").onclick=startGame;$("#newGameButton").onclick=resetGame;$("#swingButton").onclick=stopTiming;$("#cancelTimingButton").onclick=cancelTiming;$("#viewRankingButton").onclick=()=>{$("#modalBackdrop").classList.add("hidden");switchView("ranking")};$("#closeModalButton").onclick=()=>{$("#modalBackdrop").classList.add("hidden");switchView("score")};if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});render();
