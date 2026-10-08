const TABLES = {
  SYSTEM: {
    SUBMITTED: [
      'AI_ANALYZED',
      'AI_REVIEW_REQUIRED'
    ],

    AI_ANALYZED: [
      'ASSIGNED_DEPARTMENT'
    ],

    ASSIGNED_DEPARTMENT: [
      'ASSIGNED_OFFICER'
    ]
  },

  ADMIN: {
    AI_REVIEW_REQUIRED: [
      'AI_ANALYZED'
    ],

    ASSIGNED_DEPARTMENT: [
      'ASSIGNED_OFFICER'
    ],

    ASSIGNED_OFFICER: [
      'ASSIGNED_DEPARTMENT'
    ],

    UNDER_INVESTIGATION: [
      'ASSIGNED_DEPARTMENT'
    ],

    ACTION_STARTED: [
      'ASSIGNED_DEPARTMENT'
    ]
  },

  OFFICER: {
    // Officer can directly resolve an assigned complaint.
    ASSIGNED_OFFICER: [
      'UNDER_INVESTIGATION',
      'RESOLUTION_SUBMITTED'
    ],

    // These are still available if the officer wants
    // to update the case before resolving it.
    UNDER_INVESTIGATION: [
      'ACTION_STARTED',
      'RESOLUTION_SUBMITTED'
    ],

    ACTION_STARTED: [
      'RESOLUTION_SUBMITTED'
    ],

    // Allow resubmission if needed.
    RESOLUTION_SUBMITTED: [
      'ACTION_STARTED'
    ]
  },

  CITIZEN: {
    RESOLUTION_SUBMITTED: [
      'RESOLVED'
    ]
  }
};

export const STATUSES = [
  'SUBMITTED',
  'AI_ANALYZED',
  'AI_REVIEW_REQUIRED',
  'ASSIGNED_DEPARTMENT',
  'ASSIGNED_OFFICER',
  'UNDER_INVESTIGATION',
  'ACTION_STARTED',
  'RESOLUTION_SUBMITTED',
  'RESOLVED'
];

export const canTransition = (
  actor,
  from,
  to
) =>
  Boolean(
    TABLES[actor]?.[from]?.includes(to)
  );

export const allowedNext = (
  actor,
  from
) =>
  TABLES[actor]?.[from] || [];