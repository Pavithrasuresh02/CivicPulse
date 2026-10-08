import { query } from '../db/pool.js';
export async function notifyCitizen(citizenId,complaintId,type,title,body){await query('INSERT INTO notifications(citizen_id,complaint_id,type,title,body) VALUES($1,$2,$3,$4,$5)',[citizenId,complaintId,type,title,body]);}
export async function notifyOfficer(officerId,complaintId,type,title,body){await query('INSERT INTO notifications(officer_id,complaint_id,type,title,body) VALUES($1,$2,$3,$4,$5)',[officerId,complaintId,type,title,body]);}
export async function notifyAdmin(adminId,complaintId,type,title,body){await query('INSERT INTO notifications(admin_id,complaint_id,type,title,body) VALUES($1,$2,$3,$4,$5)',[adminId,complaintId,type,title,body]);}
