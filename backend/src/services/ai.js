import { env } from '../config/env.js';
import { query } from '../db/pool.js';

const CODES = [
  'DRINKING_WATER',
  'SEWAGE_DRAINAGE',
  'ROAD_POTHOLE',
  'ROAD_DAMAGE',
  'GARBAGE',
  'STREETLIGHT',
  'POWER_OUTAGE',
  'DISEASE_OUTBREAK',
  'ENVIRONMENTAL_POLLUTION',
  'TRANSPORT_PROBLEM',
  'SCHOOL_INFRASTRUCTURE',
  'OTHER'
];

const LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const LEVEL_VALUE = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

function maxLevel(a, b) {
  return LEVEL_VALUE[a] >= LEVEL_VALUE[b] ? a : b;
}

function extractJson(text) {
  const clean = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');

  if (start < 0 || end < 0) {
    throw new Error('AI returned no JSON object');
  }

  return JSON.parse(clean.slice(start, end + 1));
}

/*
 * Deterministic safety floor.
 *
 * AI can interpret the complaint, but obvious civic hazards
 * should never accidentally become NONE.
 */
function applySafetyRules(out, complaintText, affectedPeople) {
  const text = complaintText.toLowerCase();

  const hasSewage =
    text.includes('sewage') ||
    text.includes('drainage') ||
    text.includes('wastewater') ||
    text.includes('waste water') ||
    text.includes('sewer');

  const hasOverflow =
    text.includes('overflow') ||
    text.includes('overflowing') ||
    text.includes('leak') ||
    text.includes('spilling');

  const onRoad =
    text.includes('road') ||
    text.includes('street') ||
    text.includes('highway') ||
    text.includes('traffic');

  const healthWords =
    text.includes('health') ||
    text.includes('disease') ||
    text.includes('infection') ||
    text.includes('contamination') ||
    text.includes('foul odor') ||
    text.includes('foul smell') ||
    text.includes('bad smell');

  const safetyWords =
    text.includes('danger') ||
    text.includes('hazard') ||
    text.includes('unsafe') ||
    text.includes('accident') ||
    text.includes('traffic') ||
    text.includes('pedestrian');

  const durationDays =
    text.match(/(\d+)\s*days?/i);

  const days = durationDays
    ? Number(durationDays[1])
    : 0;

  /*
   * SEWAGE RULE
   */
  if (hasSewage) {
    out.category = 'SEWAGE_DRAINAGE';

    out.health_risk = maxLevel(
      out.health_risk,
      'MEDIUM'
    );

    out.severity = maxLevel(
      out.severity,
      'MEDIUM'
    );

    out.urgency = maxLevel(
      out.urgency,
      'MEDIUM'
    );

    if (hasOverflow) {
      out.health_risk = maxLevel(
        out.health_risk,
        'HIGH'
      );

      out.severity = maxLevel(
        out.severity,
        'HIGH'
      );
    }

    if (onRoad) {
      out.safety_risk = maxLevel(
        out.safety_risk,
        'HIGH'
      );

      out.urgency = maxLevel(
        out.urgency,
        'HIGH'
      );
    }

    if (healthWords) {
      out.health_risk = maxLevel(
        out.health_risk,
        'HIGH'
      );
    }

    if (safetyWords) {
      out.safety_risk = maxLevel(
        out.safety_risk,
        'HIGH'
      );
    }

    if (days >= 3) {
      out.urgency = maxLevel(
        out.urgency,
        'HIGH'
      );
    }

    if (affectedPeople >= 50) {
      out.severity = maxLevel(
        out.severity,
        'HIGH'
      );
    }

    if (affectedPeople >= 200) {
      out.severity = maxLevel(
        out.severity,
        'CRITICAL'
      );
    }
  }

  /*
   * ROAD / TRAFFIC SAFETY
   */
  if (
    text.includes('pothole') ||
    text.includes('road damage') ||
    text.includes('road broken') ||
    text.includes('road damaged')
  ) {
    out.category =
      text.includes('pothole')
        ? 'ROAD_POTHOLE'
        : 'ROAD_DAMAGE';

    out.safety_risk = maxLevel(
      out.safety_risk,
      'MEDIUM'
    );

    out.severity = maxLevel(
      out.severity,
      'MEDIUM'
    );
  }

  /*
   * DRINKING WATER
   */
  if (
    text.includes('drinking water') ||
    text.includes('water supply') ||
    text.includes('no water') ||
    text.includes('water shortage')
  ) {
    out.category = 'DRINKING_WATER';

    out.severity = maxLevel(
      out.severity,
      'MEDIUM'
    );

    out.urgency = maxLevel(
      out.urgency,
      'MEDIUM'
    );
  }

  /*
   * GARBAGE
   */
  if (
    text.includes('garbage') ||
    text.includes('trash') ||
    text.includes('waste') ||
    text.includes('dump')
  ) {
    out.category = 'GARBAGE';

    out.environmental_risk = maxLevel(
      out.environmental_risk,
      'MEDIUM'
    );

    out.severity = maxLevel(
      out.severity,
      'MEDIUM'
    );
  }

  /*
   * POLLUTION
   */
  if (
    text.includes('pollution') ||
    text.includes('toxic') ||
    text.includes('chemical') ||
    text.includes('smoke')
  ) {
    out.category =
      'ENVIRONMENTAL_POLLUTION';

    out.environmental_risk = maxLevel(
      out.environmental_risk,
      'HIGH'
    );

    out.health_risk = maxLevel(
      out.health_risk,
      'HIGH'
    );

    out.severity = maxLevel(
      out.severity,
      'HIGH'
    );
  }

  return out;
}

export async function analyzeComplaint(c) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured'
    );
  }

  const candidates = await query(
    `SELECT c.id,
            c.complaint_code,
            c.problem_report,
            c.problem_details,
            c.pincode,
            c.taluk,
            c.panchayat
     FROM complaints c
     WHERE c.id <> $1
       AND c.created_at > now() - interval '180 days'
       AND (
         c.pincode = $2
         OR lower(c.taluk) = lower($3)
       )
     ORDER BY c.created_at DESC
     LIMIT 30`,
    [c.id, c.pincode, c.taluk]
  );

  const candidateText = candidates.rows
    .map(
      (x, i) =>
        `#${i + 1} ID=${x.id} ${x.complaint_code} | ` +
        `${x.problem_report} | ${x.problem_details} | ` +
        `${x.pincode}/${x.taluk}/${x.panchayat || ''}`
    )
    .join('\n');

  const prompt = `You are the AI civic-priority analyst for CivicPulse.

Analyze the citizen complaint carefully.

Return ONLY ONE valid JSON object.

Do NOT choose an officer.
Do NOT invent government facts.
Do NOT automatically return NONE.

Use the actual complaint text as the main evidence.

IMPORTANT RISK RULES:

1. SEWAGE / SEWER / WASTEWATER
- Sewage overflow is at least MEDIUM severity.
- Sewage overflow is at least MEDIUM health risk.
- Sewage on a public road is at least HIGH safety risk.
- Sewage overflow lasting several days increases urgency.
- Foul smell, contamination or disease concerns increase health risk.
- Many affected people increase severity.

2. ROAD HAZARDS
- Potholes or dangerous road damage should have at least MEDIUM safety risk.
- If there is immediate accident danger, use HIGH or CRITICAL.

3. HEALTH / CONTAMINATION
- Disease outbreak, contamination or serious health threats should have HIGH or CRITICAL health risk.

4. ENVIRONMENTAL POLLUTION
- Serious pollution, toxic exposure or chemical contamination should have HIGH environmental and health risk.

5. URGENCY
Use HIGH when the problem is persistent, affects public movement, creates health/safety risks, or needs prompt intervention.

LEVELS:
NONE
LOW
MEDIUM
HIGH
CRITICAL

Complaint:
Report: ${c.problem_report}

Details:
${c.problem_details}

Citizen selected category:
${c.submitted_problem_type_code || 'unknown'}

Health issues:
${c.health_issues || 'none'}

People affected:
${c.people_affected}

Location:
${c.pincode}, ${c.taluk}, ${c.panchayat || 'n/a'}

Potential related complaints:
${candidateText || 'none'}

Return exactly these keys:

{
  "category": "one valid category",
  "summary": "short summary",
  "severity": "NONE/LOW/MEDIUM/HIGH/CRITICAL",
  "health_risk": "NONE/LOW/MEDIUM/HIGH/CRITICAL",
  "environmental_risk": "NONE/LOW/MEDIUM/HIGH/CRITICAL",
  "safety_risk": "NONE/LOW/MEDIUM/HIGH/CRITICAL",
  "urgency": "NONE/LOW/MEDIUM/HIGH/CRITICAL",
  "affected_people": 0,
  "recommended_action": "recommended civic action",
  "explanation": "explain why these risk levels were selected",
  "confidence": 0.0,
  "related_candidate_indices": []
}

Confidence must be between 0 and 1.

Only mark complaints as related when they clearly describe the same underlying civic issue.`;

  console.log(
    '🌐 Sending complaint to OpenRouter...'
  );

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          'http://localhost:5173',
        'X-Title':
          'CivicPulse'
      },

      body: JSON.stringify({
        model:
          env.OPENROUTER_MODEL ||
          'openrouter/free',

        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],

        temperature: 0.1
      })
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `OpenRouter API error ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const text =
    data?.choices?.[0]?.message?.content ||
    '';

  if (!text) {
    throw new Error(
      'OpenRouter returned an empty response'
    );
  }

  console.log(
    '✅ OpenRouter response received'
  );

  const out =
    extractJson(text);

  if (!CODES.includes(out.category)) {
    out.category = 'OTHER';
  }

  for (const key of [
    'severity',
    'health_risk',
    'environmental_risk',
    'safety_risk',
    'urgency'
  ]) {
    const value =
      String(out[key] || '')
        .toUpperCase();

    if (!LEVELS.includes(value)) {
      out[key] = 'NONE';
    } else {
      out[key] = value;
    }
  }

  out.affected_people =
    Math.max(
      0,
      Number(out.affected_people) ||
        Number(c.people_affected) ||
        0
    );

  out.confidence =
    Math.max(
      0,
      Math.min(
        1,
        Number(out.confidence) || 0
      )
    );

  out.related_candidate_indices =
    Array.isArray(
      out.related_candidate_indices
    )
      ? out.related_candidate_indices.filter(
          (n) =>
            Number.isInteger(n) &&
            n >= 1 &&
            n <= candidates.rows.length
        )
      : [];

  /*
   * Final deterministic safety layer.
   */
  const complaintText = `
    ${c.problem_report || ''}
    ${c.problem_details || ''}
    ${c.health_issues || ''}
  `;

  const finalAnalysis =
    applySafetyRules(
      out,
      complaintText,
      out.affected_people
    );

  console.log(
    '🧠 Final AI analysis:',
    JSON.stringify(
      finalAnalysis,
      null,
      2
    )
  );

  return {
    analysis: finalAnalysis,
    candidates: candidates.rows
  };
}