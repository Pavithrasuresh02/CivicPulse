import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function signToken(principal) { return jwt.sign({ sub: principal.id, role: principal.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' }); }

async function loadPrincipal(id, role) {
  if (role === 'CITIZEN') {
    const { rows } = await query('SELECT id,full_name,email,phone,gender,challenge_completed,civic_mind_score FROM users WHERE id=$1',[id]);
    const u=rows[0]; return u && {role:'CITIZEN',id:u.id,fullName:u.full_name,email:u.email,phone:u.phone,gender:u.gender,challengeCompleted:u.challenge_completed,civicMindScore:u.civic_mind_score};
  }
  if (role === 'OFFICER') {
    const { rows } = await query('SELECT o.id,o.login_id,o.name,o.department_id,o.jurisdiction_id,o.active,d.code department_code,d.name department_name FROM officers o JOIN departments d ON d.id=o.department_id WHERE o.id=$1',[id]);
    const o=rows[0]; return o?.active && {role:'OFFICER',id:o.id,loginId:o.login_id,name:o.name,departmentId:o.department_id,departmentCode:o.department_code,departmentName:o.department_name,jurisdictionId:o.jurisdiction_id};
  }
  if (role === 'ADMIN') {
    const { rows } = await query('SELECT id,admin_login_id,name,active FROM admin_users WHERE id=$1',[id]);
    const a=rows[0]; return a?.active && {role:'ADMIN',id:a.id,adminId:a.admin_login_id,name:a.name};
  }
  return null;
}

export async function authenticate(req,_res,next){
  try{
    const raw=req.headers.authorization||''; if(!raw.startsWith('Bearer ')) throw unauthorized();
    let p; try{p=jwt.verify(raw.slice(7),env.JWT_SECRET,{algorithms:['HS256']});}catch{throw unauthorized('Session expired. Please log in again.','TOKEN_INVALID');}
    const user=await loadPrincipal(p.sub,p.role); if(!user) throw unauthorized('Account not found or disabled.','ACCOUNT_INVALID'); req.user=user; next();
  }catch(e){next(e)}
}
export const requireRole=(...roles)=>(req,_res,next)=>roles.includes(req.user?.role)?next():next(forbidden());
