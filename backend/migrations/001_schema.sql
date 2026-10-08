CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(10) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  gender VARCHAR(30) NOT NULL CHECK (gender IN ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')),
  challenge_completed BOOLEAN NOT NULL DEFAULT FALSE,
  civic_mind_score INTEGER CHECK (civic_mind_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS problem_types (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS department_problem_types (
  problem_type_id BIGINT PRIMARY KEY REFERENCES problem_types(id) ON DELETE CASCADE,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sub_departments (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  UNIQUE (department_id, code)
);

CREATE TABLE IF NOT EXISTS jurisdictions (
  id BIGSERIAL PRIMARY KEY,
  pincode VARCHAR(6) NOT NULL,
  taluk VARCHAR(100) NOT NULL,
  panchayat VARCHAR(100),
  UNIQUE (pincode, taluk, panchayat)
);

CREATE TABLE IF NOT EXISTS officers (
  id BIGSERIAL PRIMARY KEY,
  login_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  department_id BIGINT NOT NULL REFERENCES departments(id),
  jurisdiction_id BIGINT REFERENCES jurisdictions(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  admin_login_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civic_issues (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  problem_type_id BIGINT REFERENCES problem_types(id),
  department_id BIGINT REFERENCES departments(id),
  jurisdiction_id BIGINT REFERENCES jurisdictions(id),
  officer_id BIGINT REFERENCES officers(id),
  pincode VARCHAR(6),
  taluk VARCHAR(100),
  panchayat VARCHAR(100),
  report_count INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  estimated_affected INTEGER NOT NULL DEFAULT 0 CHECK (estimated_affected >= 0),
  health_risk VARCHAR(20),
  impact_score NUMERIC(5,2),
  priority_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaints (
  id BIGSERIAL PRIMARY KEY,
  complaint_code VARCHAR(32) NOT NULL UNIQUE,
  citizen_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_type VARCHAR(20) NOT NULL CHECK (complaint_type IN ('PUBLIC','INDIVIDUAL','ASSOCIATION')),
  petitioner_address TEXT NOT NULL,
  phone VARCHAR(10) NOT NULL,
  gender VARCHAR(30) NOT NULL,
  problem_report VARCHAR(300) NOT NULL,
  problem_details TEXT NOT NULL,
  problem_type_id BIGINT REFERENCES problem_types(id),
  health_issues TEXT,
  people_affected INTEGER NOT NULL DEFAULT 0 CHECK (people_affected >= 0),
  pincode VARCHAR(6) NOT NULL,
  taluk VARCHAR(100) NOT NULL,
  panchayat VARCHAR(100),
  department_id BIGINT REFERENCES departments(id),
  jurisdiction_id BIGINT REFERENCES jurisdictions(id),
  officer_id BIGINT REFERENCES officers(id),
  civic_issue_id BIGINT REFERENCES civic_issues(id),
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','AI_ANALYZED','AI_REVIEW_REQUIRED','ASSIGNED_DEPARTMENT','ASSIGNED_OFFICER','UNDER_INVESTIGATION','ACTION_STARTED','RESOLUTION_SUBMITTED','RESOLVED')),
  ai_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (ai_status IN ('PENDING','COMPLETED','FAILED','REVIEW_REQUIRED')),
  severity VARCHAR(20),
  health_risk VARCHAR(20),
  environmental_risk VARCHAR(20),
  safety_risk VARCHAR(20),
  urgency VARCHAR(20),
  impact_score NUMERIC(5,2),
  priority_score NUMERIC(5,2),
  priority_breakdown JSONB,
  estimated_resolution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS complaint_media (
  id BIGSERIAL PRIMARY KEY,
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  secure_url TEXT NOT NULL,
  public_id TEXT,
  original_name TEXT,
  mime_type VARCHAR(120),
  bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id BIGSERIAL PRIMARY KEY,
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('COMPLETED','FAILED','REVIEW_REQUIRED')),
  model VARCHAR(120),
  category VARCHAR(50),
  problem_type_code VARCHAR(50),
  summary TEXT,
  severity VARCHAR(20),
  health_risk VARCHAR(20),
  environmental_risk VARCHAR(20),
  safety_risk VARCHAR(20),
  urgency VARCHAR(20),
  affected_people INTEGER,
  recommended_action TEXT,
  explanation TEXT,
  confidence NUMERIC(5,4),
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_reports (
  complaint_id BIGINT PRIMARY KEY REFERENCES complaints(id) ON DELETE CASCADE,
  civic_issue_id BIGINT NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
  similarity NUMERIC(5,4),
  linked_by VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_updates (
  id BIGSERIAL PRIMARY KEY,
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL,
  actor_id BIGINT,
  kind VARCHAR(40) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resolutions (
  id BIGSERIAL PRIMARY KEY,
  complaint_id BIGINT NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  officer_id BIGINT NOT NULL REFERENCES officers(id),
  description TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  citizen_feedback TEXT,
  citizen_rating INTEGER CHECK (citizen_rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS resolution_media (
  id BIGSERIAL PRIMARY KEY,
  resolution_id BIGINT NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  secure_url TEXT NOT NULL,
  public_id TEXT,
  original_name TEXT,
  mime_type VARCHAR(120),
  bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  citizen_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  officer_id BIGINT REFERENCES officers(id) ON DELETE CASCADE,
  admin_id BIGINT REFERENCES admin_users(id) ON DELETE CASCADE,
  complaint_id BIGINT REFERENCES complaints(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(citizen_id, officer_id, admin_id) = 1)
);

CREATE TABLE IF NOT EXISTS badges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  cycle_no INTEGER NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('BRONZE','SILVER','GOLD','PLATINUM')),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, complaint_id)
);

CREATE TABLE IF NOT EXISTS officer_recognitions (
  id BIGSERIAL PRIMARY KEY,
  officer_id BIGINT NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('BRONZE','SILVER','GOLD','PLATINUM')),
  period_label VARCHAR(50) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS department_recognitions (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  award VARCHAR(100) NOT NULL,
  period_label VARCHAR(50) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_scenarios (
  id BIGSERIAL PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  emoji VARCHAR(10),
  context TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS challenge_options (
  id BIGSERIAL PRIMARY KEY,
  scenario_id BIGINT NOT NULL REFERENCES challenge_scenarios(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label VARCHAR(180) NOT NULL,
  emoji VARCHAR(10),
  affected_people INTEGER NOT NULL DEFAULT 0,
  severity VARCHAR(20),
  health_risk VARCHAR(20),
  safety_risk VARCHAR(20),
  environmental_risk VARCHAR(20),
  urgency VARCHAR(20),
  priority_value NUMERIC(5,2) NOT NULL,
  rationale TEXT NOT NULL,
  UNIQUE (scenario_id, position)
);

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_position INTEGER NOT NULL DEFAULT 1 CHECK (current_position BETWEEN 1 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_score INTEGER CHECK (total_score BETWEEN 0 AND 100),
  research_consent BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_challenge_attempt_per_user ON challenge_attempts(user_id) WHERE status = 'IN_PROGRESS';

CREATE TABLE IF NOT EXISTS challenge_responses (
  id BIGSERIAL PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES challenge_attempts(id) ON DELETE CASCADE,
  scenario_id BIGINT NOT NULL REFERENCES challenge_scenarios(id) ON DELETE CASCADE,
  option_id BIGINT NOT NULL REFERENCES challenge_options(id) ON DELETE RESTRICT,
  response_ms INTEGER,
  reason TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_officer_status ON complaints(officer_id, status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_dept ON complaints(department_id, status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(pincode, taluk, panchayat);
CREATE INDEX IF NOT EXISTS idx_notifications_citizen ON notifications(citizen_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_officer ON notifications(officer_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_admin ON notifications(admin_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_complaint ON complaint_updates(complaint_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_review ON complaints(ai_status, created_at DESC) WHERE ai_status = 'REVIEW_REQUIRED';
CREATE INDEX IF NOT EXISTS idx_civic_issues_location ON civic_issues(pincode, taluk, panchayat, problem_type_id);
