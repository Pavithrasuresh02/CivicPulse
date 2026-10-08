import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function signToken(principal) {
  return jwt.sign({ sub: principal.id, role: principal.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256',
  });
}

/** Loads the principal from the DB on every request; the token role is only a hint, DB is the authority. */
async function loadPrincipal(id, role) {
  if (role === 'CITIZEN') {
    const { rows } = await query(
      `SELECT id, full_name, email, phone, gender, challenge_completed, civic_mind_score FROM users WHERE id = $1`, [id]);
    return rows[0] && { role: 'CITIZEN', id: rows[0].id, fullName: rows[0].full_name, email: rows[0].email,
      phone: rows[0].phone, gender: rows[0].gender, challengeCompleted: rows[0].challenge_completed,
      civicMindScore: rows[0].civic_mind_score };
  }
  if (role === 'OFFICER') {
    const { rows } = await query(
      `SELECT o.id, o.login_id, o.name, o.department_id, o.jurisdiction_id, o.active, d.code AS department_code, d.name AS department_name
         FROM officers o JOIN departments d ON d.id = o.department_id WHERE o.id = $1`, [id]);
    return rows[0]?.active ? { role: 'OFFICER', id: rows[0].id, loginId: rows[0].login_id, name: rows[0].name,
      departmentId: rows[0].department_id, departmentCode: rows[0].department_code,
      departmentName: rows[0].department_name, jurisdictionId: rows[0].jurisdiction_id } : null;
  }
  if (role === 'ADMIN') {
    const { rows } = await query(`SELECT id, admin_login_id, name FROM admin_users WHERE id = $1`, [id]);
    return rows[0] && { role: 'ADMIN', id: rows[0].id, adminId: rows[0].admin_login_id, name: rows[0].name };
  }
  return null;
}

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try { payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); }
    catch { throw unauthorized('Session expired. Please log in again.', 'TOKEN_INVALID'); }
    const principal = await loadPrincipal(payload.sub, payload.role);
    if (!principal) throw unauthorized('Account not found or disabled.', 'ACCOUNT_INVALID');
    req.user = principal;
    next();
  } catch (err) { next(err); }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());
