import fs from "node:fs";
import vm from "node:vm";

const fake=()=>({classList:{toggle(){},add(){},remove(){}},style:{},setAttribute(){},scrollIntoView(){},textContent:"",innerHTML:"",dataset:{},onclick:null,onchange:null,checked:false,value:"normal"});
const makeContext=(saved={})=>{
  const elements=new Map(),localStorage={data:saved,getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v},removeItem(k){delete this.data[k]}};
  const context={console,Math,JSON,Number,Array,Object,String,Boolean,localStorage,navigator:{},location:{protocol:"file:"},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},confirm:()=>true,window:{scrollTo(){}},document:{querySelector(s){if(!elements.has(s))elements.set(s,fake());return elements.get(s)},querySelectorAll(){return[]}}};
  context.__elements=elements;
  context.globalThis=context;vm.runInNewContext(fs.readFileSync("app.js","utf8"),context);return context;
};
const context=makeContext(),E=context.PGAEngine;
const html=fs.readFileSync("index.html","utf8"),appSource=fs.readFileSync("app.js","utf8"),styleSource=fs.readFileSync("styles.css","utf8"),sw=fs.readFileSync("sw.js","utf8"),manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));

const makeState=(characterId="balance",shot="normal")=>{const s=E.freshState("VERIFY",characterId);s.hole=0;s.lie="tee";s.distance=E.holes[0].yards;s.winds[0]=1;s.aim="center";return{s,opt:E.optionsFor(s).find(o=>o.id===shot)||E.optionsFor(s)[0]}};
const travelFor=(characterId,shot="normal")=>{const {s,opt}=makeState(characterId,shot);const before=s.distance;E.resolveFullShot(s,opt,E.timingResult(50,E.timingProfileFor(opt,s)),()=>.99);return before-s.distance};
const directionFor=(characterId,shot="normal")=>{const {s,opt}=makeState(characterId,shot);return E.finalDirectionFor(s,E.timingResult(100,E.timingProfileFor(opt,s)),E.holes[0],opt).error};

let holesFinished=0,maxStrokes=0;
for(let hole=0;hole<18;hole++){
  const s=E.freshState("FINISH","balance",18);s.hole=hole;s.distance=E.holes[hole].yards;s.lie="tee";s.winds[hole]=1;s.strokes=0;
  for(let turn=0;turn<14;turn++){
    const opt=E.optionsFor(s)[0],profile=E.timingProfileFor(opt,s),timing=E.timingResult(50,profile);
    const result=s.lie==="green"?E.resolvePutt(s,opt,timing,()=>.5):E.resolveFullShot(s,opt,timing,()=>.5);
    if(result.finished){holesFinished++;break}
  }
  maxStrokes=Math.max(maxStrokes,s.strokes);
}

const outside=E.optionsFor(E.freshState("OPTIONS"));
const greenState=E.freshState("GREEN");greenState.lie="green";greenState.distance=3;
const greenOptions=E.optionsFor(greenState);
const legacy=E.migrate({...E.freshState("LEGACY"),selectedShotType:"layup",attackShotsRemaining:2,attackUsed:3,favoriteShot:"layup",weakShot:"attack"});
const balance=E.freshState("BAL","balance"),power=E.freshState("POW","power"),technique=E.freshState("TEC","technique");
const normalProfiles={balance:E.timingProfileFor(outside[0],balance),power:E.timingProfileFor(outside[0],power),technique:E.timingProfileFor(outside[0],technique)};
const attackProfiles={balance:E.timingProfileFor(outside[1],balance),power:E.timingProfileFor(outside[1],power),technique:E.timingProfileFor(outside[1],technique)};
const approachSample=(distance,lie,grade)=>E.approachTravelFor({distance,lie},outside[0],{grade},E.freshState("APPROACH","technique"),()=>.5);

const chipState=E.freshState("CHIP","technique");chipState.lie="fairway";chipState.distance=8;chipState.position={progress:.82,lateral:0};chipState.winds[0]=1;
const chip=E.resolveFullShot(chipState,outside[0],E.timingResult(50,E.timingProfileFor(outside[0],chipState)),()=>0);
const hioState=E.freshState("HIO","power");hioState.hole=2;hioState.lie="tee";hioState.distance=E.holes[2].yards;hioState.winds[2]=1;
const hio=E.resolveFullShot(hioState,E.optionsFor(hioState)[0],E.timingResult(50,E.timingProfileFor(E.optionsFor(hioState)[0],hioState)),()=>0);

const obState=E.freshState("OB","power");obState.hole=1;obState.winds[1]=5;obState.aim="right";obState.lie="tee";obState.distance=E.holes[1].yards;
const obOrigin=JSON.stringify({position:obState.position,lie:obState.lie,distance:obState.distance});
const obResult=E.resolveFullShot(obState,E.optionsFor(obState)[1],E.timingResult(100,E.timingProfileFor(E.optionsFor(obState)[1],obState)),()=>0);
const whState=E.freshState("WH","power");whState.hole=6;whState.winds[6]=4;whState.aim="right";whState.lie="fairway";whState.strokes=1;whState.distance=300;whState.position={progress:.35,lateral:0};
const whOrigin=JSON.stringify({position:whState.position,lie:whState.lie,distance:whState.distance});
const whResult=E.resolveFullShot(whState,E.optionsFor(whState)[1],E.timingResult(100,E.timingProfileFor(E.optionsFor(whState)[1],whState)),()=>0);

const resultState=roundHoles=>{const s=E.freshState("RESULT","balance",roundHoles);for(let i=0;i<roundHoles;i++){s.scores[i]=E.holes[i].par;s.shots[i]=[{type:"shot",stroke:1,choice:"強めに打つ",timing:{grade:"GOOD"},outcome:"fairway",text:"残り 140ヤード"}]};s.scores[0]=E.holes[0].par-1;s.shots[0]=[{type:"shot",stroke:1,choice:"強めに打つ",distanceBefore:120,lie:"fairway",timing:{grade:"PERFECT"},outcome:"shot-in",shotInType:"SHOT IN",text:"スーパーショットがカップへ吸い込まれた！"}];return s};
const modeResults=[3,9,18].map(n=>E.buildFinalResult(resultState(n)));
const idRefs=[...appSource.matchAll(/\$\(\"#([A-Za-z0-9_-]+)\"\)/g)].map(match=>match[1]);
const htmlIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
const missingIds=[...new Set(idRefs.filter(id=>!htmlIds.has(id)))];
const shotHtmlAfter=ctx=>ctx.__elements.get("#shotOptions")?.innerHTML||"";
const fieldCardNames=markup=>markup.includes("普通に打つ")&&markup.includes("強めに打つ")&&!markup.includes("パットする");
const puttCardNames=markup=>markup.includes("パットする")&&!markup.includes("普通に打つ")&&!markup.includes("強めに打つ");
E.renderShotCards();
const renderedFieldCards=shotHtmlAfter(context);
const legacySave=E.freshState("LEGACY HOTFIX","balance",18);legacySave.selectedShotType="layup";legacySave.attackRemaining=0;legacySave.attackShotsRemaining=0;legacySave.favoriteShot=undefined;legacySave.weakShot=undefined;legacySave.preferredShot=undefined;
const legacyContext=makeContext({"pga-tour-18-save-v6":JSON.stringify(legacySave)}),legacyEngine=legacyContext.PGAEngine,legacyCards=shotHtmlAfter(legacyContext);
const noLimitState=E.freshState("NO LIMIT");noLimitState.attackRemaining=0;delete noLimitState.attackShotsRemaining;
const greenRenderContext=makeContext({"pga-tour-18-save-v6":JSON.stringify({...E.freshState("GREEN RENDER"),lie:"green",distance:2.4,greenPosition:{x:160,y:120}})});
const introContext=makeContext({"pga-tour-18-save-v6":JSON.stringify(E.freshState("INTRO HOTFIX"))});introContext.PGAEngine.dismissHoleIntro();introContext.PGAEngine.renderShotCards();
const modeStartCards=[3,9,18].map(holes=>{const s=E.freshState(`MODE ${holes}`,"balance",holes);const c=makeContext({"pga-tour-18-save-v6":JSON.stringify(s)});return shotHtmlAfter(c)});

const phaseG45={
  twoShotOptions:outside.length===2&&outside.map(o=>o.name).join("|")==="普通に打つ|強めに打つ",
  puttOnly:greenOptions.length===1&&greenOptions[0].name==="パットする",
  noLayupUi:!html.includes("刻んで打つ")&&!html.includes("刻み")&&!outside.some(o=>o.id==="layup"||o.name.includes("刻")),
  noFavoriteWeakUi:!html.includes("得意")&&!html.includes("苦手")&&!appSource.includes("得意:")&&!appSource.includes("苦手:"),
  noAttackLimitUi:!html.includes("攻め残り")&&!appSource.includes("攻め残り")&&!html.includes("attackCounter"),
  legacyMigration:legacy.selectedShotType==="normal"&&!("attackShotsRemaining" in legacy)&&!("attackUsed" in legacy)&&!("favoriteShot" in legacy)&&!("weakShot" in legacy),
  characterPerformance:E.characterPerformance("power").baseDistanceMultiplier>E.characterPerformance("balance").baseDistanceMultiplier&&E.characterPerformance("balance").baseDistanceMultiplier>E.characterPerformance("technique").baseDistanceMultiplier,
  characterTiming:normalProfiles.technique.perfect>normalProfiles.balance.perfect&&normalProfiles.balance.perfect>normalProfiles.power.perfect&&normalProfiles.technique.good>normalProfiles.balance.good&&normalProfiles.balance.good>normalProfiles.power.good,
  strongTiming:attackProfiles.balance.perfect<normalProfiles.balance.perfect&&attackProfiles.balance.good<normalProfiles.balance.good,
  distanceBalance:travelFor("power","normal")>travelFor("balance","normal")&&travelFor("balance","normal")>travelFor("technique","normal")&&travelFor("balance","attack")>travelFor("balance","normal"),
  sideMissBalance:directionFor("power","attack")>directionFor("balance","attack")&&directionFor("balance","attack")>directionFor("technique","attack")&&directionFor("balance","attack")>directionFor("balance","normal"),
  approachGuard:approachSample(60,"fairway","GOOD").travel>=48&&approachSample(45,"rough","GOOD").travel>=31&&approachSample(30,"bunker","PERFECT").travel>=18,
  shotIn:chip.finished&&chip.shotInType==="CHIP IN"&&hio.finished&&hio.shotInType==="HOLE IN ONE",
  resultModes:modeResults.every((r,i)=>r.roundHoles===[3,9,18][i]&&r.ranking.length===21&&r.stats&&r.bestShot),
  obWh:obResult.outcome==="ob"&&obState.strokes===2&&JSON.stringify({position:obState.position,lie:obState.lie,distance:obState.distance})===obOrigin&&whResult.outcome==="wh"&&whState.strokes===3&&JSON.stringify({position:whState.position,lie:whState.lie,distance:whState.distance})===whOrigin,
  pwa:manifest.display&&sw.includes("pga-tour-18-v18")&&["index.html","styles.css","app.js","manifest.webmanifest","icon.svg"].every(asset=>sw.includes(asset)),
  htmlIds:missingIds.length===0
};
const phaseG451={
  shotRenderEngine:["safeShotOptionsFor","renderShotCards","FIELD_SHOT_FALLBACK"].every(name=>appSource.includes(name)),
  fieldCardsRendered:fieldCardNames(renderedFieldCards),
  legacyLayupResume:legacyEngine.normalizeShotId(legacyEngine.migrate({...legacySave,selectedShotType:"layup"}).selectedShotType)==="normal"&&fieldCardNames(legacyCards),
  attackRemainingIgnored:E.safeShotOptionsFor(noLimitState).map(option=>option.name).join("|")==="普通に打つ|強めに打つ",
  favoriteWeakIgnored:E.safeShotOptionsFor({...E.freshState("NO PREF"),favoriteShot:undefined,weakShot:undefined,preferredShot:undefined}).length===2,
  greenPuttOnly:puttCardNames(shotHtmlAfter(greenRenderContext)),
  introDismissCards:fieldCardNames(shotHtmlAfter(introContext)),
  modeStartCards:modeStartCards.every(fieldCardNames),
  noContainerMismatch:html.includes('id="shotOptions"')&&appSource.includes('$("#shotOptions")'),
  pwaV18:sw.includes("pga-tour-18-v18")
};

const requiredCourseIds=["greenCity","shibuya","odaiba","westTokyo"];
const requiredShibuyaFields=["par","yards","areaType","timeOfDay","landmark","mapTheme"];
const playCourseModes=(courseId)=>{
  E.activateCourse(courseId);
  return[3,9,18].map(roundHoles=>{
    let resolved=0;
    for(let hole=0;hole<roundHoles;hole++){
      const s=E.freshState(`${courseId}-${roundHoles}`,"balance",roundHoles,courseId);s.hole=hole;s.distance=E.COURSES[courseId].holes[hole].yards;s.lie="tee";s.winds[hole]=1;
      for(let turn=0;turn<14;turn++){
        const opt=E.optionsFor(s)[0],timing=E.timingResult(50,E.timingProfileFor(opt,s)),result=s.lie==="green"?E.resolvePutt(s,opt,timing,()=>.5):E.resolveFullShot(s,opt,timing,()=>.5);
        if(result.finished){resolved++;break}
      }
    }
    const resultState=E.freshState(`RESULT-${courseId}`,"balance",roundHoles,courseId),courseHoles=E.COURSES[courseId].holes;
    for(let index=0;index<roundHoles;index++){resultState.scores[index]=courseHoles[index].par;resultState.shots[index]=[{type:"shot",stroke:1,choice:"普通に打つ",timing:{grade:"GOOD"},outcome:"fairway",text:"フェアウェイ"}]}
    const final=E.buildFinalResult(resultState);
    return{roundHoles,resolved,final};
  });
};
const courseRuns={greenCity:playCourseModes("greenCity"),shibuya:playCourseModes("shibuya")};
const oldCourseSave=E.freshState("OLD COURSE","balance",9,"greenCity");delete oldCourseSave.courseId;delete oldCourseSave.selectedCourseId;delete oldCourseSave.courseName;oldCourseSave.courseTheme="urban";
const migratedOldCourse=E.migrate(oldCourseSave);
E.activateCourse("shibuya",true);
const selectedCourseStored=context.localStorage.data[E.COURSE_SELECTION_KEY];
const shibuyaIntroState=E.freshState("INTRO COURSE","balance",3,"shibuya");
const shibuyaIntroContext=makeContext({"pga-tour-18-save-v6":JSON.stringify(shibuyaIntroState)});
const introCourseText=shibuyaIntroContext.__elements.get("#holeIntroCourse")?.textContent||"";
const shibuyaResultState=E.freshState("RESULT COURSE","balance",3,"shibuya");
for(let index=0;index<3;index++){shibuyaResultState.scores[index]=E.COURSES.shibuya.holes[index].par;shibuyaResultState.shots[index]=[{type:"shot",stroke:1,choice:"普通に打つ",timing:{grade:"GOOD"},outcome:"fairway",text:"フェアウェイ"}]}
shibuyaResultState.complete=true;shibuyaResultState.finalResult=E.buildFinalResult(shibuyaResultState);
const shibuyaResultContext=makeContext({"pga-tour-18-save-v6":JSON.stringify(shibuyaResultState)});
const resultCourseText=shibuyaResultContext.__elements.get("#resultModeLabel")?.textContent||"";
const phaseG5={
  courseStructure:requiredCourseIds.every(id=>Boolean(E.COURSES[id]))&&E.COURSES.greenCity.status==="available"&&E.COURSES.shibuya.status==="available"&&E.COURSES.odaiba.status==="comingSoon"&&E.COURSES.westTokyo.status==="comingSoon",
  holeCounts:E.COURSES.greenCity.holes.length===18&&E.COURSES.shibuya.holes.length===18,
  shibuyaHoleFields:E.COURSES.shibuya.holes.every(hole=>requiredShibuyaFields.every(field=>hole[field]!==undefined&&hole[field]!==null&&hole[field]!=="")),
  courseModes:Object.values(courseRuns).flat().every(run=>run.resolved===run.roundHoles&&run.final.roundHoles===run.roundHoles&&run.final.ranking.length===21),
  legacyCourseMigration:migratedOldCourse.courseId==="greenCity"&&migratedOldCourse.courseName==="GREEN CITY SPECIAL COURSE",
  selectedCourseSaved:selectedCourseStored==="shibuya",
  courseSelectionUi:html.includes('id="courseOptions"')&&appSource.includes("SHIBUYA URBAN COURSE")&&appSource.includes("COMING SOON"),
  introCourseName:introCourseText==="SHIBUYA URBAN COURSE",
  resultCourseName:resultCourseText.includes("SHIBUYA URBAN COURSE"),
  cpuUsesCoursePar:courseRuns.shibuya.every(run=>run.final.par===E.COURSES.shibuya.holes.slice(0,run.roundHoles).reduce((sum,hole)=>sum+hole.par,0)),
  existingShots:outside.length===2&&greenOptions.length===1&&greenOptions[0].id==="putt",
  pwaV18:sw.includes('const CACHE="pga-tour-18-v18"'),
  htmlIds:missingIds.length===0
};
E.activateCourse("greenCity");

console.log(JSON.stringify({
  syntax:"passed",
  phaseG45,phaseG451,phaseG5,
  outsideOptions:outside.map(o=>({id:o.id,name:o.name,desc:o.desc})),
  greenOptions:greenOptions.map(o=>o.name),
  profiles:{normalProfiles,attackProfiles},
  travel:{power:travelFor("power"),balance:travelFor("balance"),technique:travelFor("technique"),balanceStrong:travelFor("balance","attack")},
  sideMiss:{powerStrong:directionFor("power","attack"),balanceStrong:directionFor("balance","attack"),techStrong:directionFor("technique","attack"),balanceNormal:directionFor("balance","normal")},
  holesFinished,maxStrokes,
  modeResults:modeResults.map(result=>({mode:result.mode,holes:result.roundHoles,rank:result.rank,total:result.total,stats:Boolean(result.stats),best:Boolean(result.bestShot)})),
  missingIds,
  courseRuns:Object.fromEntries(Object.entries(courseRuns).map(([course,runs])=>[course,runs.map(run=>({mode:run.roundHoles,resolved:run.resolved,par:run.final.par,courseName:run.final.courseName}))])),
  serviceWorkerCache:"pga-tour-18-v18"
},null,2));
