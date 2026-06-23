import fs from "node:fs";
import vm from "node:vm";

const fake=()=>({classList:{toggle(){},add(){},remove(){}},style:{},setAttribute(){},scrollIntoView(){},textContent:"",innerHTML:"",dataset:{}});
const makeContext=(saved={})=>{const elements=new Map(),localStorage={data:saved,getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v},removeItem(k){delete this.data[k]}};const context={console,Math,JSON,Number,Array,Object,String,localStorage,navigator:{},location:{protocol:"file:"},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},confirm:()=>true,window:{scrollTo(){}},document:{querySelector(s){if(!elements.has(s))elements.set(s,fake());return elements.get(s)},querySelectorAll(){return[]}}};context.globalThis=context;vm.runInNewContext(fs.readFileSync("app.js","utf8"),context);return context};
const context=makeContext(),E=context.PGAEngine;
const fullShot=E.freshState("TEST"),greenShot={...E.freshState("PUTT"),lie:"green",distance:2.5};
const outsideOptions=E.optionsFor(fullShot),greenOptions=E.optionsFor(greenShot);
const profileChecks=Object.values(E.TIMING_PROFILES).map(profile=>({key:profile.key,perfect:E.timingResult(50+profile.perfect/2,profile).grade,good:E.timingResult(50+profile.good/2,profile).grade,normal:E.timingResult(50+profile.normal/2,profile).grade,miss:E.timingResult(50+profile.miss/2,profile).grade,bad:E.timingResult(100,profile).grade,visualTotal:+(((100-profile.miss)/2+(profile.miss-profile.normal)/2+(profile.normal-profile.good)/2+(profile.good-profile.perfect)/2+profile.perfect+(profile.good-profile.perfect)/2+(profile.normal-profile.good)/2+(profile.miss-profile.normal)/2+(100-profile.miss)/2).toFixed(5))}));
const perfect=E.timingResult(50,E.TIMING_PROFILES.normal),badRight=E.timingResult(100,E.TIMING_PROFILES.attack);
const ideal=E.freshState("TEST");ideal.winds[0]=5;
const idealResult=E.resolveFullShot(ideal,outsideOptions[0],perfect,()=>.99);
const bad=E.freshState("TEST");bad.winds[0]=5;
const badResult=E.resolveFullShot(bad,outsideOptions[1],badRight,()=>0);

let finished=0,maxStrokes=0;
for(let hole=0;hole<18;hole++){
  const s=E.freshState("TEST");s.hole=hole;s.distance=E.holes[hole].yards;s.winds[hole]=2;s.strokes=0;s.lie="tee";
  for(let turn=0;turn<12;turn++){
    const opt=E.optionsFor(s)[0],profile=E.timingProfileFor(opt,s),result=s.lie==="green"?E.resolvePutt(s,opt,E.timingResult(50,profile),()=>.5):E.resolveFullShot(s,opt,E.timingResult(50,profile),()=>.5);
    if(result.finished){finished++;break}
  }
  maxStrokes=Math.max(maxStrokes,s.strokes);
}

const legacy=E.freshState("RESUME");legacy.version=2;delete legacy.position;const migrated=E.migrate(legacy);const resumed=makeContext({"pga-tour-18-save-v2":JSON.stringify(legacy)}).PGAEngine.freshState("CHECK");
const attackState=E.freshState("ATTACK");const attackUses=Array.from({length:E.ATTACK_SHOT_LIMIT},()=>E.consumeAttackShot(attackState));const attackBlocked=!E.consumeAttackShot(attackState);
const resumedAttack=E.migrate({...E.freshState("RESUME ATTACK"),attackShotsRemaining:2});
const balance=E.freshState("BALANCE","balance"),power=E.freshState("POWER","power"),technique=E.freshState("TECH","technique");
const aimLeft={...E.freshState("AIM"),aim:"left",hole:0,lie:"tee"},aimCenter={...E.freshState("AIM"),aim:"center",hole:0,lie:"tee"};aimLeft.winds[0]=1;aimCenter.winds[0]=1;
const directionLeft=E.finalDirectionFor(aimLeft,E.timingResult(0,E.TIMING_PROFILES.normal),E.holes[0]),directionCenter=E.finalDirectionFor(aimCenter,E.timingResult(50,E.TIMING_PROFILES.normal),E.holes[0]);
const obState=E.freshState("OB","power");obState.hole=0;obState.winds[0]=5;obState.aim="right";obState.lie="tee";obState.distance=E.holes[0].yards;const obOrigin=JSON.stringify({position:obState.position,lie:obState.lie,distance:obState.distance});const obResult=E.resolveFullShot(obState,E.optionsFor(obState)[1],E.timingResult(100,E.TIMING_PROFILES.attack),()=>0);
const whState=E.freshState("WH","power");whState.hole=6;whState.winds[6]=4;whState.aim="right";whState.lie="fairway";whState.strokes=1;whState.distance=300;whState.position={progress:.35,lateral:0};const whOrigin=JSON.stringify({position:whState.position,lie:whState.lie,distance:whState.distance});const whResult=E.resolveFullShot(whState,E.optionsFor(whState)[1],E.timingResult(100,E.TIMING_PROFILES.attack),()=>0);
const flightPlan=E.createShotAnimation({progress:0,lateral:0},{progress:.56,lateral:.1},E.timingResult(50,E.TIMING_PROFILES.normal),{outcome:"fairway"},false);
const leftMissPlan=E.createShotAnimation({progress:.2,lateral:0},{progress:.64,lateral:-.5},E.timingResult(0,E.TIMING_PROFILES.normal),{outcome:"rough"},false);
const puttPlan=E.createShotAnimation({progress:.93,lateral:.08},{progress:.98,lateral:0},E.timingResult(50,E.TIMING_PROFILES.puttNear),{outcome:"cup"},true);
const missedPutt={...E.freshState("PUTT"),lie:"green",distance:5,position:{progress:.96,lateral:0}};const missedPuttResult=E.resolvePutt(missedPutt,greenOptions[0],E.timingResult(100,E.TIMING_PROFILES.puttStandard),()=>.99);
const html=fs.readFileSync("index.html","utf8"),sw=fs.readFileSync("sw.js","utf8"),manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
const timingMarkup=(html.match(/<div class="timing-zones"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||"";
console.log(JSON.stringify({
  syntax:"passed",outsideOptions:outsideOptions.map(x=>x.name),greenOptions:greenOptions.map(x=>x.name),
  profiles:profileChecks,attackPerfect:E.TIMING_PROFILES.attack.perfect,attackBadFrom:Math.floor(E.TIMING_PROFILES.attack.miss)+1,layupPerfect:E.TIMING_PROFILES.layup.perfect,layupBadFrom:Math.floor(E.TIMING_PROFILES.layup.miss)+1,
  puttProfiles:[.8,2.5,5,8,12].map(distance=>E.timingProfileFor(greenOptions[0],{...greenShot,distance}).key),
  perfectOutcome:idealResult.outcome,badOutcome:badResult.outcome,holesFinished:finished,maxStrokes,
  courseDataComplete:E.holes.every(h=>["leftRisk","rightRisk","waterRisk","bunkerRisk","obSide"].every(k=>k in h)),courseSvg:html.includes('class="course-map"'),timingBands:(timingMarkup.match(/<i><\/i>/g)||[]).length===9,legacyV2Supported:fs.readFileSync("app.js","utf8").includes('pga-tour-18-save-v2'),legacyMigration:migrated.version===5&&Boolean(migrated.position)&&Boolean(migrated.winds)&&migrated.attackShotsRemaining===E.ATTACK_SHOT_LIMIT&&migrated.characterId==="balance",characters:balance.power===78&&balance.accuracy===78&&power.power===92&&power.accuracy===62&&technique.putting===86&&technique.shortGame===88,characterTimingBonus:E.timingProfileFor(E.optionsFor(technique)[2],technique).perfect>12,directionalAim:directionLeft.side==="left"&&directionLeft.value<directionCenter.value&&directionCenter.side==="center",lieMultipliers:{fairway:[E.lieMultiplierFor("fairway",{},()=>0),E.lieMultiplierFor("fairway",{},()=>.999)],rough:[E.lieMultiplierFor("rough",{},()=>0),E.lieMultiplierFor("rough",{},()=>.999)],bunker:[E.lieMultiplierFor("bunker",{},()=>0),E.lieMultiplierFor("bunker",{},()=>.999)]},obRetry:obResult.outcome==="ob"&&obState.strokes===2&&JSON.stringify({position:obState.position,lie:obState.lie,distance:obState.distance})===obOrigin&&obResult.text.includes("次は3打目"),whRetry:whResult.outcome==="wh"&&whState.strokes===3&&JSON.stringify({position:whState.position,lie:whState.lie,distance:whState.distance})===whOrigin&&whResult.text.includes("次は4打目"),aimUi:["aimPanel","aimOptions","aimLabel","aimLine"].every(id=>html.includes(`id="${id}"`)),characterUi:html.includes('id="characterOptions"')&&html.includes('id="characterStatus"'),resultComment:E.resultComment(outsideOptions[1],perfect,{outcome:"fairway"}).includes("完璧なインパクト"),attackLimit:E.ATTACK_SHOT_LIMIT===6&&attackUses.every(Boolean)&&attackState.attackShotsRemaining===0&&attackBlocked,newGameAttackReset:E.freshState("NEW").attackShotsRemaining===6,attackResume:resumedAttack.attackShotsRemaining===2&&E.canUseAttack(resumedAttack),attackButtonState:fs.readFileSync("app.js","utf8").includes('aria-disabled'),flightAnimation:flightPlan.type==="flight"&&flightPlan.duration>=800&&flightPlan.duration<=1200&&flightPlan.control.y<flightPlan.from.y&&flightPlan.runBack>0,puttAnimation:puttPlan.type==="putt"&&puttPlan.duration<flightPlan.duration&&puttPlan.runBack===0,puttMarkerUpdates:!missedPuttResult.finished&&missedPutt.position.progress===.98&&missedPutt.position.lateral>0&&Boolean(missedPutt.greenPosition),puttDifficulties:[.8,2.5,5,8,12].map(E.puttDifficultyLabel),leftMissBendsLeft:leftMissPlan.control.x<(leftMissPlan.from.x+leftMissPlan.landing.x)/2,animationSvg:["shotTrail","flightBall","cupPulse"].every(id=>html.includes(`id="${id}"`)),greenViewSvg:["greenView","greenBallMarker","greenPuttLine","greenShotTrail","greenCupPulse","greenDistance"].every(id=>html.includes(`id="${id}"`)),unusedLegacyName:!fs.readFileSync("app.js","utf8").includes('安全に打つ'),manifest:manifest.display,serviceWorkerAssets:["index.html","styles.css","app.js","manifest.webmanifest","icon.svg"].every(x=>sw.includes(x)),cacheV6:sw.includes('v6'),resumeHarness:Boolean(resumed)
},null,2));
