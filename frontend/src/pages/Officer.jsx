import React, { useEffect, useState } from 'react';
import { api, session } from '../lib/api.js';
import {
  Shell,
  Card,
  Stat,
  Badge,
  Loading,
  Empty,
  ErrorBox
} from '../components/UI.jsx';

function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ');
}

function priorityTone(score) {
  if (Number(score) >= 80) return 'red';
  if (Number(score) >= 60) return 'gold';
  return 'default';
}

export default function OfficerHome() {
  const { user } = session();

  const [dashboard, setDashboard] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [caseData, setCaseData] = useState(null);

  const [loadingCase, setLoadingCase] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [showResolve, setShowResolve] = useState(false);
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState(null);

  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const loadDashboard = () => {
    setErr('');

    api
      .get('/officer/dashboard')
      .then(setDashboard)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const openCase = async (id) => {
    setSelectedId(id);
    setCaseData(null);
    setShowResolve(false);
    setResolutionMessage('');
    setResolutionPhoto(null);
    setErr('');
    setSuccess('');
    setLoadingCase(true);

    try {
      const data = await api.get(`/officer/complaints/${id}`);
      setCaseData(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingCase(false);
    }
  };

  const submitResolution = async (e) => {
    e.preventDefault();

    if (!resolutionMessage.trim()) {
      setErr('Please enter a resolution message.');
      return;
    }

    if (resolutionMessage.trim().length < 5) {
      setErr('Resolution message must contain at least 5 characters.');
      return;
    }

    setActionLoading(true);
    setErr('');
    setSuccess('');

    try {
      const formData = new FormData();

      formData.append(
        'description',
        resolutionMessage.trim()
      );

      if (resolutionPhoto) {
        formData.append('images', resolutionPhoto);
      }

      await api.post(
        `/officer/complaints/${selectedId}/resolve`,
        formData
      );

      setSuccess(
        'Resolution submitted successfully. The citizen has been notified.'
      );

      setShowResolve(false);
      setResolutionMessage('');
      setResolutionPhoto(null);

      const updated = await api.get(
        `/officer/complaints/${selectedId}`
      );

      setCaseData(updated);
      loadDashboard();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!dashboard) {
    return (
      <Shell user={user} title="Officer dashboard">
        <ErrorBox message={err} />
        <Loading />
      </Shell>
    );
  }

  const c = caseData?.complaint;

  return (
    <Shell user={user} title={user.departmentName}>
      <ErrorBox message={err} />

      {success && (
        <Card>
          <div className="success-box">
            {success}
          </div>
        </Card>
      )}

      {!selectedId && (
        <>
          <div className="stats">
            <Stat
              label="Pending"
              value={dashboard.metrics.pending}
            />

            <Stat
              label="In progress"
              value={dashboard.metrics.in_progress}
            />

            <Stat
              label="Resolved"
              value={dashboard.metrics.resolved}
            />

            <Stat
              label="Critical"
              value={dashboard.metrics.critical}
            />
          </div>

          <Card title="Priority queue">
            <p className="muted">
              Click a complaint to open the case and take action.
            </p>

            {dashboard.priorityQueue.length ? (
              <div>
                {dashboard.priorityQueue.map((item) => (
                  <button
                    type="button"
                    className="case-row"
                    key={item.id}
                    onClick={() => openCase(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      cursor: 'pointer',
                      background: 'transparent'
                    }}
                  >
                    <div>
                      <b>{item.complaint_code}</b>

                      <span>
                        {item.problem_report}
                      </span>

                      <small>
                        {item.pincode} · {item.taluk} ·{' '}
                        {item.panchayat}
                      </small>
                    </div>

                    <div>
                      <Badge
                        tone={priorityTone(
                          item.priority_score
                        )}
                      >
                        {item.priority_score ?? '—'} ·{' '}
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty text="No open cases." />
            )}
          </Card>

          <div className="dash-grid">
            <Card title="Department">
              <h3>{user.departmentName}</h3>

              <p className="muted">
                Your access is server-enforced using the officer
                account and assigned jurisdiction.
              </p>
            </Card>

            <Card title="Officer recognition">
              <p className="muted">
                Recognition considers verified resolutions,
                priority handled, responsiveness and citizen
                feedback rather than closure count alone.
              </p>
            </Card>
          </div>
        </>
      )}

      {selectedId && loadingCase && (
        <Card>
          <Loading />
        </Card>
      )}

      {selectedId && !loadingCase && c && (
        <>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setCaseData(null);
              setShowResolve(false);
              setErr('');
              setSuccess('');
              loadDashboard();
            }}
            style={{
              marginBottom: '16px',
              cursor: 'pointer'
            }}
          >
            ← Back to Priority Queue
          </button>

          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                alignItems: 'flex-start',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <p className="muted">
                  Complaint ID
                </p>

                <h2>{c.complaint_code}</h2>
              </div>

              <Badge tone={priorityTone(c.priority_score)}>
                Priority {c.priority_score ?? '—'}
              </Badge>
            </div>

            <hr />

            <p className="muted">
              Problem reported
            </p>

            <h3>{c.problem_report}</h3>

            <div className="dash-grid">
              <div>
                <p className="muted">Status</p>
                <b>{statusLabel(c.status)}</b>
              </div>

              <div>
                <p className="muted">Pincode</p>
                <b>{c.pincode || '—'}</b>
              </div>

              <div>
                <p className="muted">Taluk</p>
                <b>{c.taluk || '—'}</b>
              </div>

              <div>
                <p className="muted">Panchayat</p>
                <b>{c.panchayat || '—'}</b>
              </div>
            </div>
          </Card>

          {c.status !== 'RESOLUTION_SUBMITTED' &&
            c.status !== 'RESOLVED' && (
              <Card title="Officer action">
                <p className="muted">
                  Once the work is completed, mark this complaint
                  as resolved and provide the citizen with a
                  resolution message.
                </p>

                {!showResolve ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowResolve(true);
                      setErr('');
                    }}
                    className="primary-button"
                  >
                    MARK AS RESOLVED
                  </button>
                ) : (
                  <form onSubmit={submitResolution}>
                    <h3>Resolve Complaint</h3>

                    <label>
                      Resolution message *
                    </label>

                    <textarea
                      value={resolutionMessage}
                      onChange={(e) =>
                        setResolutionMessage(e.target.value)
                      }
                      placeholder="Example: Drainage blockage cleared and the affected road was cleaned."
                      rows={6}
                      maxLength={4000}
                      required
                      style={{
                        width: '100%',
                        resize: 'vertical'
                      }}
                    />

                    <small className="muted">
                      {resolutionMessage.length}/4000
                    </small>

                    <br />
                    <br />

                    <label>
                      Optional evidence photo
                    </label>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      onChange={(e) => {
                        setResolutionPhoto(
                          e.target.files?.[0] || null
                        );
                      }}
                    />

                    {resolutionPhoto && (
                      <p className="muted">
                        Selected: {resolutionPhoto.name}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '20px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={actionLoading}
                      >
                        {actionLoading
                          ? 'SUBMITTING...'
                          : 'SUBMIT RESOLUTION'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowResolve(false);
                          setResolutionMessage('');
                          setResolutionPhoto(null);
                          setErr('');
                        }}
                        disabled={actionLoading}
                      >
                        CANCEL
                      </button>
                    </div>
                  </form>
                )}
              </Card>
            )}

          {c.status === 'RESOLUTION_SUBMITTED' && (
            <Card title="Resolution submitted">
              <Badge tone="gold">
                WAITING FOR CITIZEN VERIFICATION
              </Badge>

              <p className="muted">
                The citizen has been notified and must verify
                the resolution before the complaint becomes
                fully resolved.
              </p>

              {caseData.complaint?.resolution?.description && (
                <div>
                  <p className="muted">
                    Resolution message
                  </p>

                  <p>
                    {caseData.complaint.resolution.description}
                  </p>
                </div>
              )}
            </Card>
          )}

          {c.status === 'RESOLVED' && (
            <Card title="Complaint resolved">
              <Badge tone="gold">
                RESOLVED
              </Badge>

              {caseData.complaint?.resolution?.description && (
                <div style={{ marginTop: '16px' }}>
                  <p className="muted">
                    Resolution message
                  </p>

                  <p>
                    {caseData.complaint.resolution.description}
                  </p>
                </div>
              )}
            </Card>
          )}

          {caseData.timeline?.length > 0 && (
            <Card title="Complaint timeline">
              {caseData.timeline.map((event) => (
                <div
                  key={event.id}
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      '1px solid rgba(128,128,128,0.2)'
                  }}
                >
                  <b>
                    {statusLabel(
                      event.to_status ||
                        event.kind
                    )}
                  </b>

                  {event.message && (
                    <p>{event.message}</p>
                  )}

                  <small className="muted">
                    {event.created_at
                      ? new Date(
                          event.created_at
                        ).toLocaleString()
                      : ''}
                  </small>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </Shell>
  );
}