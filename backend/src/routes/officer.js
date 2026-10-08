import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import {
  authenticate,
  requireRole
} from '../middleware/auth.js';

import { query } from '../db/pool.js';
import { getComplaint } from './complaints.js';
import { canTransition } from '../services/statusMachine.js';
import { validate } from '../middleware/validate.js';
import { ok } from '../utils/response.js';
import {
  badRequest,
  forbidden,
  notFound
} from '../utils/errors.js';

import { uploadBuffer } from '../services/cloudinary.js';

const r = Router();

r.use(
  authenticate,
  requireRole('OFFICER')
);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    cb(
      null,
      /^image\/(jpeg|png|webp|heic)$/.test(
        file.mimetype
      )
    );
  }
});

const statusSchema = z.object({
  status: z.enum([
    'UNDER_INVESTIGATION',
    'ACTION_STARTED'
  ])
});

const msg = z.object({
  message: z.string().trim().min(2).max(2000)
});

const est = z.object({
  estimatedResolutionAt: z.string().datetime()
});

const resolve = z.object({
  description: z
    .string()
    .trim()
    .min(5)
    .max(4000)
});


/* =========================================================
   OFFICER DASHBOARD
========================================================= */

r.get('/dashboard', async (req, res) => {
  const x = await query(
    `
    SELECT
      count(*) FILTER (
        WHERE status = 'ASSIGNED_OFFICER'
      ) AS pending,

      count(*) FILTER (
        WHERE status IN (
          'UNDER_INVESTIGATION',
          'ACTION_STARTED'
        )
      ) AS in_progress,

      count(*) FILTER (
        WHERE status = 'RESOLVED'
      ) AS resolved,

      count(*) FILTER (
        WHERE priority_score >= 80
          AND status <> 'RESOLVED'
      ) AS critical,

      count(*) AS total

    FROM complaints
    WHERE officer_id = $1
    `,
    [req.user.id]
  );

  const p = await query(
    `
    SELECT
      c.id,
      c.complaint_code,
      c.problem_report,
      c.status,
      c.priority_score,
      c.impact_score,
      c.pincode,
      c.taluk,
      c.panchayat,
      c.created_at,
      u.full_name AS citizen_name

    FROM complaints c

    JOIN users u
      ON u.id = c.citizen_id

    WHERE c.officer_id = $1
      AND c.status <> 'RESOLVED'

    ORDER BY
      c.priority_score DESC NULLS LAST,
      c.created_at ASC

    LIMIT 20
    `,
    [req.user.id]
  );

  ok(res, {
    metrics: x.rows[0],
    priorityQueue: p.rows
  });
});


/* =========================================================
   OFFICER COMPLAINT LIST
========================================================= */

r.get('/complaints', async (req, res) => {
  const params = [req.user.id];

  const where = [
    'c.officer_id = $1'
  ];

  let i = 2;

  if (req.query.status) {
    where.push(`c.status = $${i++}`);
    params.push(req.query.status);
  }

  if (req.query.priority) {
    where.push(
      `c.priority_score >= $${i++}`
    );

    params.push(
      Number(req.query.priority)
    );
  }

  if (req.query.pincode) {
    where.push(`c.pincode = $${i++}`);
    params.push(req.query.pincode);
  }

  const x = await query(
    `
    SELECT
      c.id,
      c.complaint_code,
      c.problem_report,
      c.status,
      c.priority_score,
      c.impact_score,
      c.pincode,
      c.taluk,
      c.panchayat,
      c.created_at,
      u.full_name AS citizen_name

    FROM complaints c

    JOIN users u
      ON u.id = c.citizen_id

    WHERE ${where.join(' AND ')}

    ORDER BY
      c.priority_score DESC NULLS LAST,
      c.created_at DESC
    `,
    params
  );

  ok(res, {
    complaints: x.rows
  });
});


/* =========================================================
   OFFICER COMPLAINT DETAIL
========================================================= */

r.get(
  '/complaints/:id',
  async (req, res) => {
    const c = await getComplaint(
      req.params.id
    );

    if (!c) {
      throw notFound();
    }

    if (c.officer_id !== req.user.id) {
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
      `,
      [c.id]
    );

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

    /*
      PostgreSQL JSON/JSONB values can already arrive
      as JavaScript objects.

      Therefore we only JSON.parse() when the value
      is actually a string.
    */

    let priorityExplanation = null;

    if (c.priority_breakdown) {
      if (
        typeof c.priority_breakdown === 'string'
      ) {
        try {
          const parsed = JSON.parse(
            c.priority_breakdown
          );

          priorityExplanation =
            parsed?.label || null;
        } catch {
          priorityExplanation = null;
        }
      } else {
        priorityExplanation =
          c.priority_breakdown?.label || null;
      }
    }

    ok(res, {
      complaint: c,
      timeline: tl.rows,
      media: media.rows,
      ai: ai.rows[0] || null,
      priorityExplanation
    });
  }
);


/* =========================================================
   UPDATE STATUS
========================================================= */

r.patch(
  '/complaints/:id/status',
  validate(statusSchema),
  async (req, res) => {
    const c = await getComplaint(
      req.params.id
    );

    if (!c) {
      throw notFound();
    }

    if (c.officer_id !== req.user.id) {
      throw forbidden();
    }

    if (
      !canTransition(
        'OFFICER',
        c.status,
        req.body.status
      )
    ) {
      throw badRequest(
        `Cannot move from ${c.status} to ${req.body.status}.`,
        'INVALID_STATUS'
      );
    }

    await query(
      `
      UPDATE complaints

      SET
        status = $1,
        updated_at = now()

      WHERE id = $2
      `,
      [
        req.body.status,
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
        'OFFICER',
        $2,
        'STATUS_CHANGE',
        $3,
        $4,
        $5
      )
      `,
      [
        c.id,
        req.user.id,
        c.status,
        req.body.status,
        req.body.status ===
        'UNDER_INVESTIGATION'
          ? 'Investigation started.'
          : 'Action started.'
      ]
    );

    await query(
      `
      INSERT INTO notifications
      (
        citizen_id,
        complaint_id,
        type,
        title,
        body
      )

      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      `,
      [
        c.citizen_id,
        c.id,
        'STATUS_UPDATE',
        'Complaint status updated',
        `Your complaint moved to ${req.body.status
          .replaceAll('_', ' ')
          .toLowerCase()}.`
      ]
    );

    ok(res, {
      updated: true
    });
  }
);


/* =========================================================
   OFFICER MESSAGE
========================================================= */

r.post(
  '/complaints/:id/update',
  validate(msg),
  async (req, res) => {
    const c = await getComplaint(
      req.params.id
    );

    if (!c) {
      throw notFound();
    }

    if (c.officer_id !== req.user.id) {
      throw forbidden();
    }

    await query(
      `
      INSERT INTO complaint_updates
      (
        complaint_id,
        actor_type,
        actor_id,
        kind,
        message
      )

      VALUES
      (
        $1,
        'OFFICER',
        $2,
        'MESSAGE',
        $3
      )
      `,
      [
        c.id,
        req.user.id,
        req.body.message
      ]
    );

    await query(
      `
      INSERT INTO notifications
      (
        citizen_id,
        complaint_id,
        type,
        title,
        body
      )

      VALUES
      (
        $1,
        $2,
        'MESSAGE',
        'Officer update',
        $3
      )
      `,
      [
        c.citizen_id,
        c.id,
        req.body.message
      ]
    );

    ok(res, {
      saved: true
    });
  }
);


/* =========================================================
   ESTIMATED RESOLUTION
========================================================= */

r.patch(
  '/complaints/:id/estimate',
  validate(est),
  async (req, res) => {
    const c = await getComplaint(
      req.params.id
    );

    if (!c) {
      throw notFound();
    }

    if (c.officer_id !== req.user.id) {
      throw forbidden();
    }

    await query(
      `
      UPDATE complaints

      SET
        estimated_resolution_at = $1,
        updated_at = now()

      WHERE id = $2
      `,
      [
        req.body.estimatedResolutionAt,
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
        message
      )

      VALUES
      (
        $1,
        'OFFICER',
        $2,
        'ESTIMATE',
        $3
      )
      `,
      [
        c.id,
        req.user.id,
        `Estimated resolution: ${req.body.estimatedResolutionAt}`
      ]
    );

    ok(res, {
      saved: true
    });
  }
);


/* =========================================================
   RESOLVE COMPLAINT
========================================================= */

r.post(
  '/complaints/:id/resolve',
  upload.array('images', 5),
  async (req, res) => {

    const d = resolve.parse(req.body);

    const c = await getComplaint(
      req.params.id
    );

    if (!c) {
      throw notFound();
    }

    if (c.officer_id !== req.user.id) {
      throw forbidden();
    }

    if (
      !canTransition(
        'OFFICER',
        c.status,
        'RESOLUTION_SUBMITTED'
      )
    ) {
      throw badRequest(
        `Cannot submit resolution from ${c.status}.`,
        'INVALID_STATUS'
      );
    }

    const existing = await query(
      `
      SELECT id
      FROM resolutions

      WHERE complaint_id = $1
      `,
      [c.id]
    );

    let resolutionId;

    if (existing.rowCount) {
      resolutionId =
        existing.rows[0].id;

      await query(
        `
        UPDATE resolutions

        SET
          description = $1,
          submitted_at = now()

        WHERE id = $2
        `,
        [
          d.description,
          resolutionId
        ]
      );
    } else {
      const x = await query(
        `
        INSERT INTO resolutions
        (
          complaint_id,
          officer_id,
          description
        )

        VALUES
        (
          $1,
          $2,
          $3
        )

        RETURNING id
        `,
        [
          c.id,
          req.user.id,
          d.description
        ]
      );

      resolutionId =
        x.rows[0].id;
    }


    /* Optional evidence photos */

    for (const f of req.files || []) {
      const uploaded = await uploadBuffer(
        f.buffer,
        'civicpulse/resolution'
      );

      if (uploaded) {
        await query(
          `
          INSERT INTO resolution_media
          (
            resolution_id,
            secure_url,
            public_id,
            original_name,
            mime_type,
            bytes
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          `,
          [
            resolutionId,
            uploaded.secure_url,
            uploaded.public_id,
            f.originalname,
            f.mimetype,
            f.size
          ]
        );
      }
    }


    /* Change complaint status */

    await query(
      `
      UPDATE complaints

      SET
        status = 'RESOLUTION_SUBMITTED',
        updated_at = now()

      WHERE id = $1
      `,
      [c.id]
    );


    /* Timeline */

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
        'OFFICER',
        $2,
        'STATUS_CHANGE',
        $3,
        'RESOLUTION_SUBMITTED',
        'Resolution submitted for citizen verification.'
      )
      `,
      [
        c.id,
        req.user.id,
        c.status
      ]
    );


    /* Notify citizen */

    await query(
      `
      INSERT INTO notifications
      (
        citizen_id,
        complaint_id,
        type,
        title,
        body
      )

      VALUES
      (
        $1,
        $2,
        'RESOLUTION_READY',
        'Resolution submitted',
        'Please review the evidence and verify the resolution.'
      )
      `,
      [
        c.citizen_id,
        c.id
      ]
    );


    ok(res, {
      submitted: true
    });
  }
);

export default r;