import bcrypt from 'bcrypt';
import { query } from '../db/pool.js';
import { signToken } from '../middleware/auth.js';
import { ok } from '../utils/response.js';
import { conflict, unauthorized, forbidden } from '../utils/errors.js';

// Used to equalize timing when an account does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const BAD_CREDENTIALS = 'Invalid credentials.';

async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash || DUMMY_HASH).then((m) => m && Boolean(hash));
}

export async function register(req, res) {
  const { fullName, email, phone, password, gender } = req.body;
  const dup = await query('SELECT email, phone FROM users WHERE email = $1 OR phone = $2', [email, phone]);
  if (dup.rows.length) {
    throw conflict(dup.rows[0].email === email ? 'An account with this email already exists.' : 'An account with this phone number already exists.', 'ACCOUNT_EXISTS');
  }
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, gender)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, full_name, email, phone, gender, challenge_completed`,
    [fullName, email, phone, hash, gender]);
  const u = rows[0];
  const user = { role: 'CITIZEN', id: u.id, fullName: u.full_name, email: u.email, phone: u.phone, gender: u.gender, challengeCompleted: u.challenge_completed };
  ok(res, { token: signToken(user), user, nextStep: 'CIVIC_DECISION_CHALLENGE' }, 201);
}

export async function loginCitizen(req, res) {
  const { identifier, password } = req.body;
  const { rows } = await query(
    `SELECT id, full_name, email, phone, gender, password_hash, challenge_completed, civic_mind_score
       FROM users WHERE email = lower($1) OR phone = $1`, [identifier]);
  const u = rows[0];
  if (!(await checkPassword(password, u?.password_hash))) throw unauthorized(BAD_CREDENTIALS, 'INVALID_CREDENTIALS');
  const user = { role: 'CITIZEN', id: u.id, fullName: u.full_name, email: u.email, phone: u.phone, gender: u.gender,
    challengeCompleted: u.challenge_completed, civicMindScore: u.civic_mind_score };
  ok(res, { token: signToken(user), user, nextStep: u.challenge_completed ? 'DASHBOARD' : 'CIVIC_DECISION_CHALLENGE' });
}

export async function loginOfficer(req, res) {
  const { departmentCode, loginId, password } = req.body;
  const { rows } = await query(
    `SELECT o.id, o.login_id, o.name, o.password_hash, o.active, o.department_id, o.jurisdiction_id,
            d.code AS department_code, d.name AS department_name
       FROM officers o JOIN departments d ON d.id = o.department_id WHERE o.login_id = $1`, [loginId]);
  const o = rows[0];
  const passwordOk = await checkPassword(password, o?.password_hash);
  if (!passwordOk || !o.active) throw unauthorized(BAD_CREDENTIALS, 'INVALID_CREDENTIALS');
  // The dropdown is NOT trusted: the officer's real department comes from the DB.
  if (o.department_code !== departmentCode) {
    throw forbidden('The selected department does not match this officer account.', 'DEPARTMENT_MISMATCH');
  }
  const user = { role: 'OFFICER', id: o.id, loginId: o.login_id, name: o.name,
    departmentId: o.department_id, departmentCode: o.department_code, departmentName: o.department_name };
  ok(res, { token: signToken(user), user });
}

export async function loginAdmin(req, res) {
  const { adminId, password } = req.body;
  const { rows } = await query('SELECT id, admin_login_id, name, password_hash FROM admin_users WHERE admin_login_id = $1', [adminId]);
  const a = rows[0];
  if (!(await checkPassword(password, a?.password_hash))) throw unauthorized(BAD_CREDENTIALS, 'INVALID_CREDENTIALS');
  const user = { role: 'ADMIN', id: a.id, adminId: a.admin_login_id, name: a.name };
  ok(res, { token: signToken(user), user });
}

export const me = (req, res) => ok(res, { user: req.user });
