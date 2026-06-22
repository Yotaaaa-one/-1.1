import fs from "node:fs";
import vm from "node:vm";

const fake=()=>({classList:{toggle(){},add(){},remove(){}},style:{},setAttribute(){},scrollIntoView(){},textContent:"",innerHTML:"",dataset:{}});
const elements=new Map();
const localStorage={data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v},removeItem(k){delete this.data[k]}};
const context={console,Math,JSON,Number,Array,Object,String,localStorage,navigator:{},location:{protocol:"file:"},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},confirm:()=>true,window:{scrollTo(){}},document:{querySelector(s){if(!elements.has(s))elements.set(s,fake());return elements.get(s)},querySelectorAll(){return[]}}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync("app.js","utf8"),context);
const E=context.PGAEngine;

const grades=[50,55,60,70,80].map(p=>E.timingResult(p).grade);
const perfect=E.timingResult(50),badRight=E.timingResult(100);
const ideal=E.freshState("TEST");ideal.winds[0]=5;
const idealResult=E.resolveFullShot(ideal,{id:"safe",name:"安全に打つ",risk:-1,power:.88},perfect,()=>.99);
const bad=E.freshState("TEST");bad.winds[0]=5;
const badResult=E.resolveFullShot(bad,{id:"attack",name:"攻める",risk:4,power:1.12},badRight,()=>0);

let finished=0,maxStrokes=0;
for(let hole=0;hole<18;hole++){
  const s=E.freshState("TEST");s.hole=hole;s.distance=E.holes[hole].yards;s.winds[hole]=2;s.strokes=0;s.lie="tee";
  for(let turn=0;turn<12;turn++){
    const opts=E.optionsFor(s),opt=opts.find(x=>x.recommended)||opts[0];
    const result=s.lie==="green"?E.resolvePutt(s,opt,perfect,()=>.5):E.resolveFullShot(s,opt,perfect,()=>.5);
    if(result.finished){finished++;break}
  }
  maxStrokes=Math.max(maxStrokes,s.strokes);
}

let obTotal=0,roundsOverTwo=0;const rounds=1000;
for(let round=0;round<rounds;round++){
  let obs=0;
  for(let hole=0;hole<18;hole++){
    const s=E.freshState("SIM");s.hole=hole;s.distance=E.holes[hole].yards;s.winds[hole]=1+Math.random()*5;s.lie="tee";
    const opts=E.optionsFor(s),opt=(s.distance>260&&Math.random()<.35?opts.find(x=>x.id==="attack"):null)||opts.find(x=>x.id==="safe")||opts.find(x=>x.id==="center")||opts[0];
    const result=E.resolveFullShot(s,opt,E.timingResult(Math.random()*100),Math.random);
    if(result.outcome==="ob")obs++;
  }
  obTotal+=obs;if(obs>2)roundsOverTwo++;
}

const html=fs.readFileSync("index.html","utf8"),sw=fs.readFileSync("sw.js","utf8"),manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
console.log(JSON.stringify({syntax:"passed",timingGrades:grades,perfectOutcome:idealResult.outcome,badOutcome:badResult.outcome,badSide:bad.position.lateral>0?"right":"left",holesFinished:finished,maxStrokes,averageOB:+(obTotal/rounds).toFixed(3),roundsOverTwoPercent:+(roundsOverTwo/rounds*100).toFixed(1),courseDataComplete:E.holes.every(h=>["leftRisk","rightRisk","waterRisk","bunkerRisk","obSide"].every(k=>k in h)),courseSvg:html.includes('class="course-map"'),manifest:manifest.display,serviceWorkerAssets:["index.html","styles.css","app.js","manifest.webmanifest","icon.svg"].every(x=>sw.includes(x))},null,2));
