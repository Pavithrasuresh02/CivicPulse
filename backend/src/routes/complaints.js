import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query } from '../db/pool.js';

import {
  calculatePriority
} from '../services/priority.js';

import {
  resolveRoute
} from '../services/routing.js';

import {
  analyzeComplaint
} from '../services/ai.js';

import {
  linkOrCreateIssue
} from '../services/issues.js';

import {
  uploadBuffer
} from '../services/cloudinary.js';

import {
  notifyCitizen,
  notifyOfficer,
  notifyAdmin
} from '../services/notifications.js';

import {
  awardNextBadge
} from '../services/badges.js';

import {
  canTransition
} from '../services/statusMachine.js';

import {
  ok
} from '../utils/response.js';

import {
  badRequest,
  notFound,
  forbidden
} from '../utils/errors.js';

const r = Router();

/* -------------------------------------------------------
   IMAGE UPLOAD
------------------------------------------------------- */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|webp|heic)$/i.test(
      file.mimetype
    );

    cb(null, allowed);
  }
});

/* -------------------------------------------------------
   VALIDATION
------------------------------------------------------- */

const createSchema = z.object({
  complaintType: z.enum([
    'PUBLIC',
    'INDIVIDUAL',
    'ASSOCIATION'
  ]),

  petitionerAddress: z
    .string()
    .trim()
    .min(5)
    .max(500),

  phone: z
    .string()
    .regex(/^\d{10}$/),

  gender: z.enum([
    'MALE',
    'FEMALE',
    'OTHER',
    'PREFER_NOT_TO_SAY'
  ]),

  problemReport: z
    .string()
    .trim()
    .min(5)
    .max(300),

  problemDetails: z
    .string()
    .trim()
    .min(5)
    .max(5000),

  problemTypeCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(50),

  healthIssues: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .default(''),

  peopleAffected: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000000),

  pincode: z
    .string()
    .regex(/^\d{6}$/),

  taluk: z
    .string()
    .trim()
    .min(2)
    .max(100),

  panchayat: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default('')
});

const updateSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2)
    .max(2000)
});

const estimateSchema = z.object({
  estimatedResolutionAt: z.string().datetime()
});

const resolveSchema = z.object({
  description: z
    .string()
    .trim()
    .min(5)
    .max(4000)
});

const verifySchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .optional(),

  feedback: z
    .string()
    .trim()
    .max(1000)
    .optional()
});

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function code() {
  const d = new Date();

  return `CP-${d
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '')}-${String(Date.now()).slice(-6)}`;
}

async function addMedia(files, table, id) {
  for (const f of files || []) {
    try {
      const uploaded = await uploadBuffer(
        f.buffer,
        `civicpulse/${table}`
      );

      if (!uploaded) {
        console.warn(
          '⚠️ Image upload skipped:',
          f.originalname
        );

        continue;
      }

      if (table === 'complaint') {
        await query(
          `INSERT INTO complaint_media
          (
            complaint_id,
            secure_url,
            public_id,
            original_name,
            mime_type,
            bytes
          )
          VALUES($1,$2,$3,$4,$5,$6)`,
          [
            id,
            uploaded.secure_url,
            uploaded.public_id,
            f.originalname,
            f.mimetype,
            f.size
          ]
        );
      } else {
        await query(
          `INSERT INTO resolution_media
          (
            resolution_id,
            secure_url,
            public_id,
            original_name,
            mime_type,
            bytes
          )
          VALUES($1,$2,$3,$4,$5,$6)`,
          [
            id,
            uploaded.secure_url,
            uploaded.public_id,
            f.originalname,
            f.mimetype,
            f.size
          ]
        );
      }

      console.log(
        `✅ Image uploaded: ${f.originalname}`
      );
    } catch (error) {
      console.error(
        `❌ Image upload failed for ${f.originalname}:`,
        error
      );
    }
  }
}

async function getComplaint(id) {
  const x = await query(
    `
    SELECT
      c.*,
      u.full_name AS citizen_name,
      u.email AS citizen_email,

      pt.code AS problem_type_code,
      pt.name AS problem_type_name,

      d.code AS department_code,
      d.name AS department_name,

      o.login_id AS officer_login_id,
      o.name AS officer_name,

      j.taluk AS jurisdiction_taluk,
      j.panchayat AS jurisdiction_panchayat

    FROM complaints c

    JOIN users u
      ON u.id = c.citizen_id

    LEFT JOIN problem_types pt
      ON pt.id = c.problem_type_id

    LEFT JOIN departments d
      ON d.id = c.department_id

    LEFT JOIN officers o
      ON o.id = c.officer_id

    LEFT JOIN jurisdictions j
      ON j.id = c.jurisdiction_id

    WHERE c.id = $1
    `,
    [id]
  );

  return x.rows[0];
}

function ensureCitizen(c, uid) {
  if (!c || c.citizen_id !== uid) {
    throw forbidden();
  }
}

/* -------------------------------------------------------
   CREATE COMPLAINT
------------------------------------------------------- */

r.post(
  '/',
  authenticate,
  requireRole('CITIZEN'),
  upload.array('images', 5),
  async (req, res) => {

    if (!req.user.challengeCompleted) {
      throw forbidden(
        'Complete the Civic Decision Challenge before filing your first complaint.',
        'CHALLENGE_REQUIRED'
      );
    }

    const d = createSchema.parse(req.body);

    let complaintId;

    /* -----------------------------------------------
       CREATE BASE COMPLAINT
    ------------------------------------------------ */

    const inserted = await query(
      `
      INSERT INTO complaints
      (
        complaint_code,
        citizen_id,
        complaint_type,
        petitioner_address,
        phone,
        gender,
        problem_report,
        problem_details,
        problem_type_id,
        health_issues,
        people_affected,
        pincode,
        taluk,
        panchayat,
        status,
        ai_status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        (
          SELECT id
          FROM problem_types
          WHERE code = $9
        ),
        $10,
        $11,
        $12,
        $13,
        $14,
        'SUBMITTED',
        'PENDING'
      )
      RETURNING id, complaint_code
      `,
      [
        code(),
        req.user.id,
        d.complaintType,
        d.petitionerAddress,
        d.phone,
        d.gender,
        d.problemReport,
        d.problemDetails,
        d.problemTypeCode,
        d.healthIssues || '',
        d.peopleAffected,
        d.pincode,
        d.taluk,
        d.panchayat || ''
      ]
    );

    complaintId = inserted.rows[0].id;

    /* -----------------------------------------------
       SAVE IMAGES
    ------------------------------------------------ */

    await addMedia(
      req.files,
      'complaint',
      complaintId
    );

    /* -----------------------------------------------
       TIMELINE
    ------------------------------------------------ */

    await query(
      `
      INSERT INTO complaint_updates
      (
        complaint_id,
        actor_type,
        kind,
        to_status,
        message
      )
      VALUES
      (
        $1,
        'SYSTEM',
        'STATUS_CHANGE',
        'SUBMITTED',
        'Complaint received by CivicPulse.'
      )
      `,
      [complaintId]
    );

    /* -----------------------------------------------
       CITIZEN NOTIFICATION
    ------------------------------------------------ */

    await notifyCitizen(
      req.user.id,
      complaintId,
      'COMPLAINT_SUBMITTED',
      'Complaint submitted',
      `Your complaint ${inserted.rows[0].complaint_code} was received.`
    );

    /* -----------------------------------------------
       GET COMPLAINT FOR AI
    ------------------------------------------------ */

    const base = await getComplaint(
      complaintId
    );

    base.submitted_problem_type_code =
      d.problemTypeCode;

    /* -----------------------------------------------
       AI ANALYSIS
    ------------------------------------------------ */

    try {
      console.log(
        `🤖 Starting AI analysis for complaint ${inserted.rows[0].complaint_code}...`
      );

      const {
        analysis,
        candidates
      } = await analyzeComplaint(base);

      console.log(
        '✅ AI analysis received:',
        {
          category: analysis.category,
          confidence: analysis.confidence
        }
      );

      const review =
        analysis.confidence < 0.60;

      /* ---------------------------------------------
         UPDATE COMPLAINT WITH AI DATA
      --------------------------------------------- */

      if (!review) {

        await query(
          `
          UPDATE complaints
          SET
            problem_type_id =
              (
                SELECT id
                FROM problem_types
                WHERE code = $1
              ),

            severity = $2,
            health_risk = $3,
            environmental_risk = $4,
            safety_risk = $5,
            urgency = $6,
            people_affected = $7,
            ai_status = 'COMPLETED'

          WHERE id = $8
          `,
          [
            analysis.category,
            analysis.severity,
            analysis.health_risk,
            analysis.environmental_risk,
            analysis.safety_risk,
            analysis.urgency,
            analysis.affected_people,
            complaintId
          ]
        );

      } else {

        await query(
          `
          UPDATE complaints
          SET
            ai_status = 'REVIEW_REQUIRED',
            status = 'AI_REVIEW_REQUIRED',
            severity = $2,
            health_risk = $3,
            environmental_risk = $4,
            safety_risk = $5,
            urgency = $6,
            people_affected = $7

          WHERE id = $8
          `,
          [
            analysis.category,
            analysis.severity,
            analysis.health_risk,
            analysis.environmental_risk,
            analysis.safety_risk,
            analysis.urgency,
            analysis.affected_people,
            complaintId
          ]
        );
      }

      /* ---------------------------------------------
         SAVE AI ANALYSIS
      --------------------------------------------- */

      await query(
        `
        INSERT INTO ai_analyses
        (
          complaint_id,
          status,
          model,
          category,
          problem_type_code,
          summary,
          severity,
          health_risk,
          environmental_risk,
          safety_risk,
          urgency,
          affected_people,
          recommended_action,
          explanation,
          confidence,
          raw_json
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        `,
        [
          complaintId,
          review
            ? 'REVIEW_REQUIRED'
            : 'COMPLETED',

          process.env.OPENROUTER_MODEL ||
            'openrouter/free',

          analysis.category,
          analysis.summary,
          analysis.severity,
          analysis.health_risk,
          analysis.environmental_risk,
          analysis.safety_risk,
          analysis.urgency,
          analysis.affected_people,
          analysis.recommended_action,
          analysis.explanation,
          analysis.confidence,
          analysis
        ]
      );

      /* ---------------------------------------------
         ADMIN REVIEW
      --------------------------------------------- */

      if (review) {

        await notifyAdminForReview(
          complaintId
        );

      } else {

        /* -------------------------------------------
           ROUTING
        ------------------------------------------- */

        const route =
          await resolveRoute(
            {
              query: query.bind(null)
            },
            {
              problemTypeCode:
                analysis.category,

              pincode: d.pincode,

              taluk: d.taluk,

              panchayat:
                d.panchayat || ''
            }
          );

        /* -------------------------------------------
           PRIORITY
        ------------------------------------------- */

        const priority =
          calculatePriority({
            severity:
              analysis.severity,

            healthRisk:
              analysis.health_risk,

            environmentalRisk:
              analysis.environmental_risk,

            safetyRisk:
              analysis.safety_risk,

            urgency:
              analysis.urgency,

            peopleAffected:
              analysis.affected_people,

            relatedReports:
              analysis
                .related_candidate_indices
                .length,

            durationDays: 0
          });

        /* -------------------------------------------
           ASSIGN DEPARTMENT / OFFICER
        ------------------------------------------- */

        if (route.department) {

          await query(
            `
            INSERT INTO complaint_updates
            (
              complaint_id,
              actor_type,
              kind,
              to_status,
              message
            )
            VALUES
            (
              $1,
              'SYSTEM',
              'STATUS_CHANGE',
              'AI_ANALYZED',
              'AI analysis completed successfully.'
            )
            `,
            [complaintId]
          );

          await query(
            `
            UPDATE complaints
            SET
              department_id = $1,
              jurisdiction_id = $2,
              officer_id = $3,
              status = $4,
              impact_score = $5,
              priority_score = $6,
              priority_breakdown = $7

            WHERE id = $8
            `,
            [
              route.department.id,
              route.jurisdiction?.id || null,
              route.officer?.id || null,

              route.officer
                ? 'ASSIGNED_OFFICER'
                : 'ASSIGNED_DEPARTMENT',

              priority.impactScore,
              priority.priorityScore,
              priority.breakdown,

              complaintId
            ]
          );

          /* -----------------------------------------
             CIVIC ISSUE
          ----------------------------------------- */

          await linkOrCreateIssue({
            complaint: {
              ...base,
              ...d,
              id: complaintId,

              people_affected:
                analysis.affected_people,

              health_risk:
                analysis.health_risk
            },

            category:
              analysis.category,

            departmentId:
              route.department.id,

            jurisdictionId:
              route.jurisdiction?.id || null,

            officerId:
              route.officer?.id || null,

            priority,

            aiCandidates:
              analysis
                .related_candidate_indices
                .map(
                  i => candidates[i - 1]
                )
                .filter(Boolean)
          });

          /* -----------------------------------------
             ROUTING TIMELINE
          ----------------------------------------- */

          await query(
            `
            INSERT INTO complaint_updates
            (
              complaint_id,
              actor_type,
              kind,
              to_status,
              message
            )
            VALUES
            (
              $1,
              'SYSTEM',
              'STATUS_CHANGE',
              $2,
              $3
            )
            `,
            [
              complaintId,

              route.officer
                ? 'ASSIGNED_OFFICER'
                : 'ASSIGNED_DEPARTMENT',

              `Automatically routed: ${route.department.name}${
                route.officer
                  ? ` → ${route.officer.name}`
                  : ' → Admin review needed'
              }.`
            ]
          );

          /* -----------------------------------------
             OFFICER NOTIFICATION
          ----------------------------------------- */

          if (route.officer) {

            await notifyOfficer(
              route.officer.id,
              complaintId,
              'NEW_CASE',
              'New CivicPulse case',
              `Complaint ${inserted.rows[0].complaint_code} is assigned to you.`
            );
          }
        }
      }

    } catch (e) {

      /* ---------------------------------------------
         IMPORTANT:
         NEVER HIDE AI ERROR
      --------------------------------------------- */

      console.error(
        '\n❌ AI ANALYSIS FAILED\n'
      );

      console.error(
        'Complaint:',
        inserted.rows[0].complaint_code
      );

      console.error(
        'Error:',
        e
      );

      console.error(
        'Message:',
        e?.message
      );

      console.error(
        'Stack:',
        e?.stack
      );

      /* ---------------------------------------------
         MARK AI FAILED
      --------------------------------------------- */

      await query(
        `
        UPDATE complaints
        SET ai_status = 'FAILED'
        WHERE id = $1
        `,
        [complaintId]
      );

      /* ---------------------------------------------
         SAVE FAILURE
      --------------------------------------------- */

      await query(
        `
        INSERT INTO ai_analyses
        (
          complaint_id,
          status,
          model,
          summary,
          explanation
        )
        VALUES
        (
          $1,
          'FAILED',
          $2,
          'AI analysis unavailable.',
          'Complaint was stored successfully and can be retried by admin.'
        )
        `,
        [
          complaintId,
          process.env.OPENROUTER_MODEL ||
            'openrouter/free'
        ]
      );
    }

    /* -----------------------------------------------
       FINAL RESPONSE
    ------------------------------------------------ */

    const final =
      await getComplaint(complaintId);

    ok(
      res,
      {
        complaint: final,

        message:
          'Complaint created. AI analysis and routing status are available on the case.'
      },
      201
    );
  }
);

/* -------------------------------------------------------
   ADMIN AI REVIEW NOTIFICATION
------------------------------------------------------- */

async function notifyAdminForReview(
  complaintId
) {
  const a = await query(
    `
    SELECT id
    FROM admin_users
    WHERE active = true
    ORDER BY id
    LIMIT 1
    `
  );

  if (a.rowCount) {

    await notifyAdmin(
      a.rows[0].id,
      complaintId,
      'AI_REVIEW_REQUIRED',
      'AI review required',
      `Complaint ${complaintId} needs classification review.`
    );
  }
}

/* -------------------------------------------------------
   CITIZEN — MY COMPLAINTS
------------------------------------------------------- */

r.get(
  '/my',
  authenticate,
  requireRole('CITIZEN'),
  async (req, res) => {

    const x = await query(
      `
      SELECT
        c.id,
        c.complaint_code,
        c.problem_report,
        c.status,
        c.priority_score,
        c.impact_score,
        c.department_id,
        d.name AS department_name,
        c.officer_id,
        o.name AS officer_name,
        c.created_at,
        c.updated_at

      FROM complaints c

      LEFT JOIN departments d
        ON d.id = c.department_id

      LEFT JOIN officers o
        ON o.id = c.officer_id

      WHERE c.citizen_id = $1

      ORDER BY c.created_at DESC
      `,
      [req.user.id]
    );

    ok(res, {
      complaints: x.rows
    });
  }
);

/* -------------------------------------------------------
   GET SINGLE COMPLAINT
------------------------------------------------------- */

r.get(
  '/:id',
  authenticate,
  async (req, res) => {

    const c =
      await getComplaint(
        req.params.id
      );

    if (!c) {
      throw notFound();
    }

    if (
      req.user.role === 'CITIZEN'
    ) {
      ensureCitizen(
        c,
        req.user.id
      );
    }

    if (
      req.user.role === 'OFFICER' &&
      c.officer_id !== req.user.id
    ) {
      throw forbidden();
    }

    const tl = await query(
      `
      SELECT *
      FROM complaint_updates

      WHERE complaint_id = $1

      ORDER BY created_at
      `,
      [c.id]
    );

    const media = await query(
      `
      SELECT *
      FROM complaint_media

      WHERE complaint_id = $1

      ORDER BY created_at
      `,
      [c.id]
    );

    const reso = await query(
      `
      SELECT
        r.*,
        o.name AS officer_name

      FROM resolutions r

      JOIN officers o
        ON o.id = r.officer_id

      WHERE r.complaint_id = $1
      `,
      [c.id]
    );

    const rmedia =
      reso.rowCount
        ? await query(
            `
            SELECT *
            FROM resolution_media

            WHERE resolution_id = $1

            ORDER BY created_at
            `,
            [reso.rows[0].id]
          )
        : { rows: [] };

    const ai = await query(
      `
      SELECT *
      FROM ai_analyses

      WHERE complaint_id = $1

      ORDER BY created_at DESC

      LIMIT 1
      `,
      [c.id]
    );

    const issue =
      c.civic_issue_id
        ? await query(
            `
            SELECT *
            FROM civic_issues

            WHERE id = $1
            `,
            [c.civic_issue_id]
          )
        : { rows: [] };

    const related =
      c.civic_issue_id
        ? await query(
            `
            SELECT
              c.id,
              c.complaint_code,
              c.problem_report,
              c.status,
              c.priority_score,
              c.created_at

            FROM complaints c

            JOIN issue_reports ir
              ON ir.complaint_id = c.id

            WHERE ir.civic_issue_id = $1

            ORDER BY c.created_at DESC
            `,
            [c.civic_issue_id]
          )
        : { rows: [] };

    ok(res, {
      complaint: c,
      timeline: tl.rows,
      media: media.rows,

      resolution:
        reso.rows[0]
          ? {
              ...reso.rows[0],
              media: rmedia.rows
            }
          : null,

      ai:
        ai.rows[0] || null,

      civicIssue:
        issue.rows[0] || null,

      relatedReports:
        related.rows
    });
  }
);

/* -------------------------------------------------------
   CITIZEN VERIFY RESOLUTION
------------------------------------------------------- */

r.post(
  '/:id/verify',
  authenticate,
  requireRole('CITIZEN'),
  validate(verifySchema),
  async (req, res) => {

    const c =
      await getComplaint(
        req.params.id
      );

    ensureCitizen(
      c,
      req.user.id
    );

    if (
      !canTransition(
        'CITIZEN',
        c.status,
        'RESOLVED'
      )
    ) {
      throw badRequest(
        'This complaint is not ready for verification.',
        'VERIFY_NOT_READY'
      );
    }

    const d = req.body;

    await query(
      `
      UPDATE complaints

      SET
        status = 'RESOLVED',
        resolved_at = now(),
        updated_at = now()

      WHERE id = $1
      `,
      [c.id]
    );

    await query(
      `
      UPDATE resolutions

      SET
        verified_at = now(),
        citizen_rating = $1,
        citizen_feedback = $2

      WHERE complaint_id = $3
      `,
      [
        d.rating || null,
        d.feedback || null,
        c.id
      ]
    );

    await query(
      `
      INSERT INTO complaint_updates
      (
        complaint_id,
        actor_type,
        actor_id,
        kind,
        from_status,
        to_status,
        message
      )
      VALUES
      (
        $1,
        'CITIZEN',
        $2,
        'STATUS_CHANGE',
        'RESOLUTION_SUBMITTED',
        'RESOLVED',
        'Citizen verified the resolution.'
      )
      `,
      [
        c.id,
        req.user.id
      ]
    );

    const badge =
      await awardNextBadge(
        req.user.id,
        c.id
      );

    if (c.officer_id) {
      await notifyOfficer(
        c.officer_id,
        c.id,
        'COMPLAINT_VERIFIED',
        'Resolution verified',
        `Citizen verified complaint ${c.complaint_code}.`
      );
    }

    ok(res, {
      resolved: true,
      badge
    });
  }
);

/* -------------------------------------------------------
   EXPORT
------------------------------------------------------- */

export const officerCaseRouter = r;

export {
  getComplaint
};

export default r;