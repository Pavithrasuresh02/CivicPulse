import { query } from '../db/pool.js';
const TIERS=['BRONZE','SILVER','GOLD','PLATINUM'];
export async function awardNextBadge(userId,complaintId){
 const {rows}=await query('SELECT count(*)::int n FROM badges WHERE user_id=$1',[userId]); const seq=rows[0].n+1; const cycle=Math.floor((seq-1)/4)+1; const tier=TIERS[(seq-1)%4];
 await query('INSERT INTO badges(user_id,complaint_id,sequence_no,cycle_no,tier) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,complaint_id) DO NOTHING',[userId,complaintId,seq,cycle,tier]);
 return {sequenceNo:seq,cycleNo:cycle,tier,championEligible:cycle>=4 && tier==='PLATINUM'};
}
