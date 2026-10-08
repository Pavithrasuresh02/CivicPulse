import { Router } from 'express';import {authenticate} from '../middleware/auth.js';import {query} from '../db/pool.js';import {ok} from '../utils/response.js';import {notFound} from '../utils/errors.js';
const r=Router();r.use(authenticate);function where(u){return u.role==='CITIZEN'?['citizen_id',u.id]:u.role==='OFFICER'?['officer_id',u.id]:['admin_id',u.id]}
r.get('/',async(req,res)=>{const [col,id]=where(req.user);const x=await query(`SELECT * FROM notifications WHERE ${col}=$1 ORDER BY created_at DESC LIMIT 100`,[id]);ok(res,{notifications:x.rows})});
r.patch('/:id/read',async(req,res)=>{const [col,id]=where(req.user);const x=await query(`UPDATE notifications SET is_read=true WHERE id=$1 AND ${col}=$2 RETURNING id`,[req.params.id,id]);if(!x.rowCount)throw notFound();ok(res,{read:true})});
export default r;
