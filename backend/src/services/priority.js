export const LEVELS={NONE:0,LOW:.25,MEDIUM:.5,HIGH:.75,CRITICAL:1};
const lv=x=>LEVELS[String(x||'NONE').toUpperCase()]??0; const clamp01=x=>Math.max(0,Math.min(1,x)); const r1=n=>Math.round(n*10)/10;
export function calculatePriority({severity,healthRisk,environmentalRisk,safetyRisk,urgency,peopleAffected=0,relatedReports=0,durationDays=0}){
 const people=Math.max(0,Number(peopleAffected)||0);
 const breakdown={severity:r1(20*lv(severity)),affectedPopulation:r1(20*clamp01(Math.log10(1+people)/Math.log10(1+2000))),healthRisk:r1(20*lv(healthRisk)),urgency:r1(10*lv(urgency)+5*clamp01((Number(durationDays)||0)/14)),relatedReports:r1(15*clamp01((Number(relatedReports)||0)/10)),environmentalSafety:r1(10*Math.max(lv(environmentalRisk),lv(safetyRisk)))};
 const priorityScore=Math.min(100,Math.round(Object.values(breakdown).reduce((a,b)=>a+b,0)));
 const impactScore=Math.min(100,Math.round(((breakdown.severity+breakdown.affectedPopulation+breakdown.healthRisk+breakdown.environmentalSafety)/70)*100));
 return {priorityScore,impactScore,label:priorityLabel(priorityScore),breakdown};
}
export const priorityLabel=s=>s>=80?'CRITICAL':s>=60?'HIGH':s>=35?'MEDIUM':'LOW';
export const explainPriority=b=>{const names={severity:'severity',affectedPopulation:'affected population',healthRisk:'health risk',urgency:'urgency and duration',relatedReports:'related reports',environmentalSafety:'environmental/safety risk'};const top=Object.entries(b||{}).sort((a,c)=>c[1]-a[1]).filter(([,v])=>v>0).slice(0,3);return top.length?`Main drivers: ${top.map(([k,v])=>`${names[k]} (${v})`).join(', ')}.`:'No significant risk factors recorded.'};
