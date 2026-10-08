/**
 * Deterministic priority calculation. The AI's own numeric score is never used.
 *
 * PRIORITY SCORE (0-100) = sum of:
 *   Severity               0-20   20 * level(severity)
 *   Affected population    0-20   20 * min(1, log10(1+people) / log10(1+2000))
 *   Health risk            0-20   20 * level(healthRisk)
 *   Urgency + duration     0-15   10 * level(urgency) + 5 * min(1, durationDays / 14)
 *   Related reports        0-15   15 * min(1, relatedReports / 10)
 *   Environmental/Safety   0-10   10 * max(level(env), level(safety))
 *
 * IMPACT SCORE (0-100) = (severity + population + health + env/safety) / 70 * 100
 * (how bad the problem is, independent of time and report volume).
 *
 * level(): NONE 0, LOW .25, MEDIUM .5, HIGH .75, CRITICAL 1.
 * Labels: >=80 CRITICAL, >=60 HIGH, >=35 MEDIUM, else LOW.
 */
export const LEVELS = { NONE: 0, LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1 };
export const LEVEL_NAMES = Object.keys(LEVELS);

const lv = (name) => LEVELS[String(name || 'NONE').toUpperCase()] ?? 0;
const r1 = (n) => Math.round(n * 10) / 10;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function calculatePriority({
  severity, healthRisk, environmentalRisk, safetyRisk, urgency,
  peopleAffected = 0, relatedReports = 0, durationDays = 0,
}) {
  const people = Math.max(0, Number(peopleAffected) || 0);
  const breakdown = {
    severity: r1(20 * lv(severity)),
    affectedPopulation: r1(20 * clamp01(Math.log10(1 + people) / Math.log10(1 + 2000))),
    healthRisk: r1(20 * lv(healthRisk)),
    urgency: r1(10 * lv(urgency) + 5 * clamp01((Number(durationDays) || 0) / 14)),
    relatedReports: r1(15 * clamp01((Number(relatedReports) || 0) / 10)),
    environmentalSafety: r1(10 * Math.max(lv(environmentalRisk), lv(safetyRisk))),
  };
  const priorityScore = Math.min(100, Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0)));
  const impactScore = Math.min(100, Math.round(
    ((breakdown.severity + breakdown.affectedPopulation + breakdown.healthRisk + breakdown.environmentalSafety) / 70) * 100));
  return { priorityScore, impactScore, label: priorityLabel(priorityScore), breakdown };
}

export function priorityLabel(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

/** Human-readable explanation for the officer "priority explanation" panel. */
export function explainPriority(breakdown) {
  const names = {
    severity: 'severity', affectedPopulation: 'number of people affected', healthRisk: 'health risk',
    urgency: 'urgency and duration', relatedReports: 'related citizen reports', environmentalSafety: 'environmental/safety risk',
  };
  const top = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0).slice(0, 3);
  return top.length ? `Main drivers: ${top.map(([k, v]) => `${names[k]} (${v})`).join(', ')}.` : 'No significant risk factors recorded.';
}
