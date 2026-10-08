export const STATUSES = [
  'SUBMITTED', 'AI_ANALYZED', 'AI_REVIEW_REQUIRED', 'ASSIGNED_DEPARTMENT', 'ASSIGNED_OFFICER',
  'UNDER_INVESTIGATION', 'ACTION_STARTED', 'RESOLUTION_SUBMITTED', 'RESOLVED',
];

// Transitions each actor may perform. Anything not listed is rejected.
const SYSTEM = {
  SUBMITTED: ['AI_ANALYZED', 'AI_REVIEW_REQUIRED'],
  AI_ANALYZED: ['ASSIGNED_DEPARTMENT'],
  ASSIGNED_DEPARTMENT: ['ASSIGNED_OFFICER'],
};
const ADMIN = {
  AI_REVIEW_REQUIRED: ['ASSIGNED_DEPARTMENT'],
  ASSIGNED_DEPARTMENT: ['ASSIGNED_OFFICER'],
  ASSIGNED_OFFICER: ['ASSIGNED_DEPARTMENT'],   // reroute
  UNDER_INVESTIGATION: ['ASSIGNED_DEPARTMENT'],
  ACTION_STARTED: ['ASSIGNED_DEPARTMENT'],
};
const OFFICER = {
  ASSIGNED_OFFICER: ['UNDER_INVESTIGATION'],
  UNDER_INVESTIGATION: ['ACTION_STARTED'],
  ACTION_STARTED: ['RESOLUTION_SUBMITTED'],
  RESOLUTION_SUBMITTED: ['ACTION_STARTED'],    // evidence rejected / more work required
};
// Verification (RESOLUTION_SUBMITTED -> RESOLVED) is performed by the citizen or system, never directly by an officer.
const VERIFIER = { RESOLUTION_SUBMITTED: ['RESOLVED'] };

const TABLES = { SYSTEM, ADMIN, OFFICER, CITIZEN: VERIFIER };

export function canTransition(actor, from, to) {
  return Boolean(TABLES[actor]?.[from]?.includes(to));
}
export function allowedNext(actor, from) {
  return TABLES[actor]?.[from] ?? [];
}
