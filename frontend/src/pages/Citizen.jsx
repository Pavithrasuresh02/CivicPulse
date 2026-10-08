import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, session } from '../lib/api.js';
import {
  Shell,
  Card,
  Stat,
  Badge,
  Loading,
  ErrorBox,
  Empty
} from '../components/UI.jsx';


// ============================================================
// CITIZEN HOME
// ============================================================

export function CitizenHome() {
  const { user } = session();

  const [data, setData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/complaints/my'),
      api.get('/notifications'),
      api.get('/badges')
    ])
      .then(([c, n, b]) => {
        setData({
          c: c.complaints,
          notes: n.notifications,
          b: b
        });
      })
      .catch(e => setErr(e.message));
  }, []);

  if (!data) {
    return (
      <Shell user={user} title="Citizen dashboard">
        <Loading />
      </Shell>
    );
  }

  const active = data.c.filter(
    x => x.status !== 'RESOLVED'
  ).length;

  const res = data.c.filter(
    x => x.status === 'RESOLVED'
  ).length;

  return (
    <Shell
      user={user}
      title={`Welcome back, ${user.fullName.split(' ')[0]}`}
      nav={[
        { href: '/citizen', label: 'Home' },
        { href: '/report', label: 'Report' },
        { href: '/badges', label: 'Badges' }
      ]}
    >
      <ErrorBox message={err} />

      <div className="stats">
        <Stat
          label="Active cases"
          value={active}
        />

        <Stat
          label="Resolved"
          value={res}
        />

        <Stat
          label="Civic Mind Score"
          value={user.civicMindScore ?? '—'}
          sub="/100"
        />

        <Stat
          label="Notifications"
          value={data.notes.filter(n => !n.is_read).length}
        />
      </div>

      <div className="dash-grid">
        <Card title="Report a problem" accent>
          <p className="muted">
            Describe it once. CivicPulse handles AI analysis,
            issue grouping, priority and routing.
          </p>

          <Link
            className="primary-btn"
            to="/report"
          >
            Start a report
          </Link>
        </Card>

        <Card title="Your latest badge">
          <div className="badge-hero">
            🏆

            <div>
              <b>
                {data.b.badges?.[0]?.tier || 'Not earned yet'}
              </b>

              <p className="muted">
                {data.b.badges?.[0]
                  ? `Badge #${data.b.badges[0].sequence_no}`
                  : 'Verify your first resolved case.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Recent complaints">
        {data.c.length ? (
          data.c.slice(0, 6).map(c => (
            <Link
              className="case-row"
              to={`/complaint/${c.id}`}
              key={c.id}
            >
              <div>
                <b>{c.complaint_code}</b>

                <span>
                  {c.problem_report}
                </span>
              </div>

              <div>
                <Badge
                  tone={
                    c.status === 'RESOLVED'
                      ? 'silver'
                      : c.priority_score >= 80
                      ? 'red'
                      : 'default'
                  }
                >
                  {c.status.replaceAll('_', ' ')}
                </Badge>

                <small>
                  {c.priority_score ?? '—'} priority
                </small>
              </div>
            </Link>
          ))
        ) : (
          <Empty text="No complaints yet." />
        )}
      </Card>
    </Shell>
  );
}


// ============================================================
// REPORT COMPLAINT
// ============================================================

export function Report() {
  const { user } = session();
  const nav = useNavigate();

  const [problemTypes, setProblemTypes] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [f, setF] = useState({
    complaintType: 'PUBLIC',
    petitionerAddress: '',
    phone: user.phone || '',
    gender: user.gender || 'PREFER_NOT_TO_SAY',
    problemReport: '',
    problemDetails: '',
    problemTypeCode: 'DRINKING_WATER',
    healthIssues: '',
    peopleAffected: '1',
    pincode: '600045',
    taluk: 'Tambaram',
    panchayat: 'Selaiyur'
  });

  const [files, setFiles] = useState([]);

  useEffect(() => {
    api.get('/auth/problem-types')
      .then(d => {
        setProblemTypes(
          d.problemTypes.map(x => x.code)
        );

        if (d.problemTypes[0]) {
          setF(x => ({
            ...x,
            problemTypeCode: d.problemTypes[0].code
          }));
        }
      })
      .catch(() => {
        setProblemTypes([
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
        ]);
      });
  }, []);

  const upd = (k, v) => {
    setF({
      ...f,
      [k]: v
    });
  };

  const submit = async () => {
    setErr('');
    setLoading(true);

    try {
      const fd = new FormData();

      Object.entries(f).forEach(([k, v]) => {
        fd.append(k, v);
      });

      files.forEach(file => {
        fd.append('images', file);
      });

      const d = await api.post(
        '/complaints',
        fd
      );

      nav(`/complaint/${d.complaint.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell
      user={user}
      title="Report a civic problem"
      nav={[
        { href: '/citizen', label: 'Home' },
        { href: '/report', label: 'Report' }
      ]}
    >
      <div className="wizard">

        <div className="wizard-steps">
          {['Issue', 'Impact', 'Location', 'Evidence'].map(
            (x, i) => (
              <div
                className={step === i + 1 ? 'active' : ''}
                key={x}
              >
                <span>{i + 1}</span>
                {x}
              </div>
            )
          )}
        </div>


        {/* STEP 1 */}
        {step === 1 && (
          <Card title="What happened?">

            <label>
              Complaint type

              <select
                value={f.complaintType}
                onChange={e =>
                  upd(
                    'complaintType',
                    e.target.value
                  )
                }
              >
                <option>PUBLIC</option>
                <option>INDIVIDUAL</option>
                <option>ASSOCIATION</option>
              </select>
            </label>


            <label>
              Problem type

              <select
                value={f.problemTypeCode}
                onChange={e =>
                  upd(
                    'problemTypeCode',
                    e.target.value
                  )
                }
              >
                {problemTypes.map(x => (
                  <option key={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>


            <label>
              One-line problem summary

              <input
                value={f.problemReport}
                onChange={e =>
                  upd(
                    'problemReport',
                    e.target.value
                  )
                }
                placeholder="e.g. Brown water from every tap"
              />
            </label>


            <label>
              Describe the problem

              <textarea
                rows="6"
                value={f.problemDetails}
                onChange={e =>
                  upd(
                    'problemDetails',
                    e.target.value
                  )
                }
              />
            </label>


            <div className="actions">
              <button
                className="primary-btn"
                onClick={() => setStep(2)}
                disabled={
                  !f.problemReport ||
                  !f.problemDetails
                }
              >
                Next
              </button>
            </div>

          </Card>
        )}


        {/* STEP 2 */}
        {step === 2 && (
          <Card title="Who is affected?">

            <label>
              People affected

              <input
                type="number"
                min="0"
                value={f.peopleAffected}
                onChange={e =>
                  upd(
                    'peopleAffected',
                    e.target.value
                  )
                }
              />
            </label>


            <label>
              Health issues

              <textarea
                rows="3"
                value={f.healthIssues}
                onChange={e =>
                  upd(
                    'healthIssues',
                    e.target.value
                  )
                }
                placeholder="Optional — mention symptoms or risks"
              />
            </label>


            <div className="actions">

              <button
                className="secondary-btn"
                onClick={() => setStep(1)}
              >
                Back
              </button>

              <button
                className="primary-btn"
                onClick={() => setStep(3)}
              >
                Next
              </button>

            </div>

          </Card>
        )}


        {/* STEP 3 */}
        {step === 3 && (
          <Card title="Where is it?">

            <label>
              Petitioner address

              <textarea
                rows="4"
                value={f.petitionerAddress}
                onChange={e =>
                  upd(
                    'petitionerAddress',
                    e.target.value
                  )
                }
              />
            </label>


            <div className="grid2">

              <label>
                Pincode

                <input
                  maxLength="6"
                  value={f.pincode}
                  onChange={e =>
                    upd(
                      'pincode',
                      e.target.value.replace(
                        /\D/g,
                        ''
                      )
                    )
                  }
                />
              </label>


              <label>
                Taluk

                <input
                  value={f.taluk}
                  onChange={e =>
                    upd(
                      'taluk',
                      e.target.value
                    )
                  }
                />
              </label>

            </div>


            <label>
              Panchayat / locality

              <input
                value={f.panchayat}
                onChange={e =>
                  upd(
                    'panchayat',
                    e.target.value
                  )
                }
              />
            </label>


            <div className="actions">

              <button
                className="secondary-btn"
                onClick={() => setStep(2)}
              >
                Back
              </button>

              <button
                className="primary-btn"
                onClick={() => setStep(4)}
              >
                Next
              </button>

            </div>

          </Card>
        )}


        {/* STEP 4 */}
        {step === 4 && (
          <Card title="Add evidence">

            <label className="file-drop">

              Camera / gallery

              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={e =>
                  setFiles(
                    Array.from(
                      e.target.files || []
                    ).slice(0, 5)
                  )
                }
              />

              <span>
                {files.length
                  ? `${files.length} image(s) selected`
                  : 'Add up to 5 images'}
              </span>

            </label>


            <div className="review">

              <b>What happens next</b>

              <p>
                Saved first → AI analyzes →
                related reports are grouped →
                priority is calculated →
                department, jurisdiction and officer
                are selected automatically.
              </p>

            </div>


            <ErrorBox message={err} />


            <div className="actions">

              <button
                className="secondary-btn"
                onClick={() => setStep(3)}
              >
                Back
              </button>


              <button
                className="primary-btn"
                onClick={submit}
                disabled={loading}
              >
                {loading ? (
                  <Loading />
                ) : (
                  'Submit complaint'
                )}
              </button>

            </div>

          </Card>
        )}

      </div>
    </Shell>
  );
}


// ============================================================
// BADGES
// ============================================================

export function Badges() {
  const { user } = session();

  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/badges')
      .then(setD)
      .catch(e => {
        console.error(
          'Badges loading error:',
          e
        );
      });
  }, []);

  if (!d) {
    return (
      <Shell
        user={user}
        title="Badges"
      >
        <Loading />
      </Shell>
    );
  }

  return (
    <Shell
      user={user}
      title="Civic recognition"
      nav={[
        { href: '/citizen', label: 'Home' },
        { href: '/report', label: 'Report' },
        { href: '/badges', label: 'Badges' }
      ]}
    >

      <Card
        title={`Civic Mind Score · ${
          d.profile.civic_mind_score ?? '—'
        }/100`}
      >

        <div className="mind-meter">
          <div
            style={{
              width: `${
                d.profile.civic_mind_score || 0
              }%`
            }}
          />
        </div>

        <p className="muted">
          Earned through the first-time Civic
          Decision Challenge. This is a platform
          score, not an official government rating.
        </p>

      </Card>


      <div className="badge-grid">

        {[
          'BRONZE',
          'SILVER',
          'GOLD',
          'PLATINUM'
        ].map(t => (
          <div
            className="tier-card"
            key={t}
          >

            <div className="tier-icon">
              {t === 'BRONZE'
                ? '🥉'
                : t === 'SILVER'
                ? '🥈'
                : t === 'GOLD'
                ? '🥇'
                : '💎'}
            </div>

            <b>{t}</b>

            <p>
              {
                d.badges.filter(
                  x => x.tier === t
                ).length
              } earned
            </p>

          </div>
        ))}

      </div>


      <Card title="Your badge history">

        {d.badges.length ? (
          d.badges.map(b => (
            <div
              className="case-row"
              key={b.id}
            >

              <div>

                <b>
                  {b.tier} · badge #{b.sequence_no}
                </b>

                <span>
                  {b.complaint_code} ·{' '}
                  {b.problem_report}
                </span>

              </div>

              <small>
                {new Date(
                  b.earned_at
                ).toLocaleDateString()}
              </small>

            </div>
          ))
        ) : (
          <Empty
            text="Resolve and verify your first complaint to earn Bronze."
          />
        )}

      </Card>

    </Shell>
  );
}


// ============================================================
// COMPLAINT DETAIL
// ============================================================

export function ComplaintDetail() {
  const { user } = session();

  const id = location.pathname
    .split('/')
    .pop();

  const nav = useNavigate();

  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    api.get(`/complaints/${id}`)
      .then(setD)
      .catch(e => setErr(e.message));
  }, [id]);

  if (!d) {
    return (
      <Shell
        user={user}
        title="Complaint"
      >
        <ErrorBox message={err} />
        <Loading />
      </Shell>
    );
  }

  const c = d.complaint;

  return (
    <Shell
      user={user}
      title={c.complaint_code}
      nav={[
        {
          href:
            user.role === 'CITIZEN'
              ? '/citizen'
              : user.role === 'OFFICER'
              ? '/officer'
              : '/admin',
          label: 'Back'
        }
      ]}
    >

      {/* ======================================================
          CASE OVERVIEW + AI
      ====================================================== */}

      <div className="detail-grid">

        <Card title="Case overview">

          <div className="detail-fields">

            <div>
              <b>Problem</b>

              <span>
                {c.problem_report}
              </span>
            </div>


            <div>
              <b>Status</b>

              <Badge
                tone={
                  c.priority_score >= 80
                    ? 'red'
                    : c.status === 'RESOLVED'
                    ? 'silver'
                    : 'default'
                }
              >
                {c.status.replaceAll(
                  '_',
                  ' '
                )}
              </Badge>
            </div>


            <div>
              <b>Priority</b>

              <span>
                {c.priority_score ?? '—'} / 100
                {' · '}
                {c.impact_score ?? '—'} impact
              </span>
            </div>


            <div>
              <b>Route</b>

              <span>
                {c.department_name || 'Pending'}

                {c.officer_name
                  ? ` → ${c.officer_name}`
                  : ''}
              </span>
            </div>


            <div>
              <b>Location</b>

              <span>
                {c.pincode} · {c.taluk} ·{' '}
                {c.panchayat}
              </span>
            </div>

          </div>

        </Card>


        <Card title="AI analysis">

          <div className="ai-panel">

            {d.ai ? (
              <>
                <Badge
                  tone={
                    d.ai.confidence !== null &&
                    d.ai.confidence < 0.6
                      ? 'red'
                      : 'green'
                  }
                >
                  {d.ai.confidence !== null
                    ? `Confidence ${Math.round(
                        Number(
                          d.ai.confidence
                        ) * 100
                      )}%`
                    : 'AI analysis unavailable'}
                </Badge>


                <h3>
                  {d.ai.summary ||
                    'AI analysis unavailable.'}
                </h3>


                <p>
                  {d.ai.explanation ||
                    'AI analysis is currently unavailable. Admin can retry.'}
                </p>


                <div className="factor-grid">

                  <span>
                    Severity

                    <strong>
                      {d.ai.severity ?? '—'}
                    </strong>
                  </span>


                  <span>
                    Health

                    <strong>
                      {d.ai.health_risk ?? '—'}
                    </strong>
                  </span>


                  <span>
                    Urgency

                    <strong>
                      {d.ai.urgency ?? '—'}
                    </strong>
                  </span>


                  <span>
                    Affected

                    <strong>
                      {d.ai.affected_people ?? '—'}
                    </strong>
                  </span>

                </div>

              </>
            ) : (
              <p className="muted">
                AI analysis is pending or failed.
                Admin can retry.
              </p>
            )}

          </div>

        </Card>

      </div>


      {/* ======================================================
          TIMELINE
      ====================================================== */}

      <Card title="Timeline">

        <div className="timeline">

          {d.timeline.map(x => (
            <div
              className="timeline-row"
              key={x.id}
            >

              <span className="dot" />

              <div>

                <b>
                  {x.to_status?.replaceAll(
                    '_',
                    ' '
                  ) || x.kind}
                </b>

                <p>
                  {x.message}
                </p>

                <small>
                  {new Date(
                    x.created_at
                  ).toLocaleString()}
                </small>

              </div>

            </div>
          ))}

        </div>

      </Card>


      {/* ======================================================
          RELATED REPORTS
      ====================================================== */}

      {d.relatedReports?.length > 1 && (
        <Card
          title={`Related reports · ${d.relatedReports.length}`}
        >

          <p className="muted">
            These individual complaints remain
            separate records while being linked to
            one Civic Issue.
          </p>


          {d.relatedReports.map(r => (
            <div
              className="case-row"
              key={r.id}
            >

              <div>

                <b>
                  {r.complaint_code}
                </b>

                <span>
                  {r.problem_report}
                </span>

              </div>


              <Badge>
                {r.status.replaceAll(
                  '_',
                  ' '
                )}
              </Badge>

            </div>
          ))}

        </Card>
      )}


      {/* ======================================================
          OFFICER RESOLUTION + CITIZEN VERIFICATION
      ====================================================== */}

      {c.status === 'RESOLUTION_SUBMITTED' &&
        user.role === 'CITIZEN' && (

          <Card
            title="Officer resolution"
            accent
          >

            <p className="muted">
              The officer has submitted a resolution for your
              complaint. Review the message and evidence below
              before accepting it.
            </p>


            {/* OFFICER RESOLUTION MESSAGE */}

            <div className="resolution-box">

              <b>Resolution message</b>

              <p>
                {d.resolution?.description ||
                  'The officer did not provide a resolution message.'}
              </p>

            </div>


            {/* RESOLUTION PHOTOS */}

            {d.resolution?.media?.length > 0 && (

              <div className="resolution-evidence">

                <b>Resolution evidence</b>

                <div className="evidence-grid">

                  {d.resolution.media.map(
                    (m, index) => (

                      <img
                        key={m.id || index}
                        src={m.url}
                        alt={`Resolution evidence ${index + 1}`}
                        className="evidence-image"
                      />

                    )
                  )}

                </div>

              </div>

            )}


            {/* CITIZEN VERIFICATION */}

            <div className="verification-box">

              <h3>
                Is the problem actually resolved?
              </h3>

              <p className="muted">
                Accept the resolution only if the issue
                has actually been fixed.
              </p>


              <label>
                Rating

                <select
                  value={rating}
                  onChange={e =>
                    setRating(
                      Number(e.target.value)
                    )
                  }
                >

                  <option value={5}>
                    5 - Excellent
                  </option>

                  <option value={4}>
                    4 - Good
                  </option>

                  <option value={3}>
                    3 - Okay
                  </option>

                  <option value={2}>
                    2 - Poor
                  </option>

                  <option value={1}>
                    1 - Not resolved
                  </option>

                </select>

              </label>


              <label>
                Feedback

                <textarea
                  rows="4"
                  value={feedback}
                  onChange={e =>
                    setFeedback(
                      e.target.value
                    )
                  }
                  placeholder="Tell us about the resolution..."
                />

              </label>


              <button
                className="primary-btn"
                onClick={async () => {

                  try {

                    setErr('');

                    await api.post(
                      `/complaints/${id}/verify`,
                      {
                        rating,
                        feedback
                      }
                    );

                    const updated =
                      await api.get(
                        `/complaints/${id}`
                      );

                    setD(updated);

                  } catch (e) {

                    setErr(
                      e.message
                    );

                  }

                }}
              >
                ✓ Accept & Resolve
              </button>


              <ErrorBox message={err} />

            </div>

          </Card>

        )}


      {/* ======================================================
          RESOLVED MESSAGE
      ====================================================== */}

      {c.status === 'RESOLVED' && (
        <Card
          title="Complaint resolved"
          accent
        >

          <div className="resolution-box">

            <h3>
              ✓ Resolution accepted
            </h3>

            {d.resolution?.description && (
              <>
                <b>Officer's resolution</b>

                <p>
                  {d.resolution.description}
                </p>
              </>
            )}

            {d.resolution?.media?.length > 0 && (

              <div className="resolution-evidence">

                <b>Resolution evidence</b>

                <div className="evidence-grid">

                  {d.resolution.media.map(
                    (m, index) => (

                      <img
                        key={m.id || index}
                        src={m.url}
                        alt={`Resolution evidence ${index + 1}`}
                        className="evidence-image"
                      />

                    )
                  )}

                </div>

              </div>

            )}

            <p className="muted">
              You accepted this resolution.
              Thank you for helping CivicPulse
              keep the community informed.
            </p>

          </div>

        </Card>
      )}

    </Shell>
  );
}