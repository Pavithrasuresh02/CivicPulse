/**
 * Deterministic routing engine. Claude never selects an officer.
 *
 *  problem type --(department_problem_types)--> department
 *  department + pincode/taluk/panchayat --> officer, by match specificity:
 *     4  exact panchayat jurisdiction
 *     3  taluk-level jurisdiction (same pincode + taluk, panchayat NULL)
 *     1  department-wide fallback officer (no jurisdiction)
 *  Ties are broken by lowest open caseload, then login_id (stable).
 *  No eligible officer => officer = null (admin must reroute); never guessed.
 */
export async function resolveRoute(db, { problemTypeCode, pincode, taluk, panchayat }) {
  const dept = await db.query(
    `SELECT d.id, d.code, d.name
       FROM problem_types pt
       JOIN department_problem_types dpt ON dpt.problem_type_id = pt.id
       JOIN departments d ON d.id = dpt.department_id
      WHERE pt.code = $1`, [problemTypeCode]);
  if (!dept.rows.length) return { department: null, officer: null, jurisdiction: null, matchLevel: 0, reason: 'NO_DEPARTMENT_MAPPING' };
  return resolveOfficerInDepartment(db, dept.rows[0], { pincode, taluk, panchayat });
}

export async function resolveOfficerInDepartment(db, department, { pincode, taluk, panchayat }) {
  const { rows } = await db.query(
    `SELECT o.id, o.login_id, o.name, o.jurisdiction_id, j.pincode, j.taluk, j.panchayat,
            CASE
              WHEN o.jurisdiction_id IS NULL THEN 1
              WHEN j.pincode = $2 AND lower(j.taluk) = lower($3) AND lower(j.panchayat) = lower($4) THEN 4
              WHEN j.pincode = $2 AND lower(j.taluk) = lower($3) AND j.panchayat IS NULL THEN 3
              ELSE 0
            END AS match_level,
            (SELECT count(*) FROM complaints c
               WHERE c.officer_id = o.id AND c.status NOT IN ('RESOLVED')) AS open_cases
       FROM officers o
       LEFT JOIN jurisdictions j ON j.id = o.jurisdiction_id
      WHERE o.department_id = $1 AND o.active = TRUE`,
    [department.id, pincode, taluk, panchayat]);

  const eligible = rows
    .filter((r) => r.match_level > 0)
    .sort((a, b) => b.match_level - a.match_level || Number(a.open_cases) - Number(b.open_cases) || a.login_id.localeCompare(b.login_id));
  if (!eligible.length) return { department, officer: null, jurisdiction: null, matchLevel: 0, reason: 'NO_ELIGIBLE_OFFICER' };

  const best = eligible[0];
  const label = { 4: 'EXACT_PANCHAYAT', 3: 'TALUK_LEVEL', 1: 'DEPARTMENT_WIDE' }[best.match_level];
  return {
    department,
    officer: { id: best.id, loginId: best.login_id, name: best.name },
    jurisdiction: best.jurisdiction_id
      ? { id: best.jurisdiction_id, pincode: best.pincode, taluk: best.taluk, panchayat: best.panchayat }
      : null,
    matchLevel: best.match_level,
    reason: label,
  };
}
