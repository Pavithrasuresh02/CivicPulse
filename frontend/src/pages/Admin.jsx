import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, session } from "../lib/api.js";
import {
  Shell,
  Card,
  Stat,
  Badge,
  Loading,
  Empty,
  ErrorBox,
} from "../components/UI.jsx";

export default function AdminHome() {
  const { user } = session();

  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setError("");

        const result = await api.get("/admin/dashboard");

        if (mounted) {
          setData(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || "Failed to load admin dashboard.");
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (!data) {
    return (
      <Shell user={user} title="Admin Command Center">
        {error && <ErrorBox message={error} />}
        <Loading />
      </Shell>
    );
  }

  return (
    <Shell
      user={user}
      title="Admin Command Center"
      nav={[{ href: "/admin", label: "Dashboard" }]}
    >
      {error && <ErrorBox message={error} />}

      <div className="stats">
        <Stat label="All Complaints" value={data.metrics?.total ?? 0} />
        <Stat label="Open" value={data.metrics?.open ?? 0} />
        <Stat label="Resolved" value={data.metrics?.resolved ?? 0} />
        <Stat label="Critical" value={data.metrics?.critical ?? 0} />
        <Stat label="AI Review" value={data.metrics?.ai_review ?? 0} />
      </div>

      <div className="tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>

        <button
          className={tab === "complaints" ? "active" : ""}
          onClick={() => setTab("complaints")}
        >
          Complaints
        </button>

        <button
          className={tab === "analytics" ? "active" : ""}
          onClick={() => setTab("analytics")}
        >
          Analytics
        </button>

        <button
          className={tab === "people" ? "active" : ""}
          onClick={() => setTab("people")}
        >
          People
        </button>
      </div>

      {tab === "overview" && (
        <AdminOverview data={data} />
      )}

      {tab === "complaints" && (
        <AdminComplaints />
      )}

      {tab === "analytics" && (
        <AdminAnalytics />
      )}

      {tab === "people" && (
        <AdminPeople />
      )}
    </Shell>
  );
}


/* =========================
   OVERVIEW
========================= */

function AdminOverview({ data }) {
  const departments = Array.isArray(data.departments)
    ? data.departments
    : [];

  const recent = Array.isArray(data.recent)
    ? data.recent
    : [];

  return (
    <>
      <Card title="Department Performance">
        {departments.length === 0 ? (
          <Empty text="No department data available." />
        ) : (
          <div className="dept-grid">
            {departments.map((department) => (
              <div
                className="dept-card"
                key={department.id}
              >
                <b>{department.name}</b>

                <span>
                  {department.open ?? 0} open ·{" "}
                  {department.resolved ?? 0} resolved
                </span>

                <small>
                  Average priority:{" "}
                  {department.avg_priority ?? 0}
                </small>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent Activity">
        {recent.length === 0 ? (
          <Empty text="No recent complaints." />
        ) : (
          recent.map((complaint) => (
            <Link
              className="case-row"
              to={`/complaint/${complaint.id}`}
              key={complaint.id}
            >
              <div>
                <b>{complaint.complaint_code}</b>

                <span>
                  {complaint.problem_report}
                </span>

                <small>
                  {complaint.citizen_name || "Unknown citizen"}
                  {" · "}
                  {complaint.department_name ||
                    "Awaiting route"}
                </small>
              </div>

              <div>
                <Badge
                  tone={
                    complaint.ai_status ===
                    "REVIEW_REQUIRED"
                      ? "red"
                      : Number(
                          complaint.priority_score
                        ) >= 80
                      ? "gold"
                      : "default"
                  }
                >
                  {complaint.ai_status ===
                  "REVIEW_REQUIRED"
                    ? "AI REVIEW"
                    : `${complaint.priority_score ?? "—"} PRIORITY`}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </Card>
    </>
  );
}


/* =========================
   COMPLAINTS
========================= */

function AdminComplaints() {
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadComplaints() {
      try {
        const result = await api.get(
          "/admin/complaints"
        );

        if (mounted) {
          setItems(
            Array.isArray(result.complaints)
              ? result.complaints
              : []
          );
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Failed to load complaints."
          );
          setItems([]);
        }
      }
    }

    loadComplaints();

    return () => {
      mounted = false;
    };
  }, []);

  if (items === null) {
    return <Loading />;
  }

  const query = search.trim().toLowerCase();

  const filtered = items.filter((complaint) => {
    const text = [
      complaint.complaint_code,
      complaint.problem_report,
      complaint.citizen_name,
      complaint.department_name,
      complaint.officer_name,
      complaint.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(query);
  });

  return (
    <Card title="Global Complaint Register">
      {error && <ErrorBox message={error} />}

      <input
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
        placeholder="Search complaints..."
      />

      <div style={{ marginTop: "16px" }}>
        {filtered.length === 0 ? (
          <Empty text="No complaints found." />
        ) : (
          filtered.map((complaint) => (
            <Link
              className="case-row"
              to={`/complaint/${complaint.id}`}
              key={complaint.id}
            >
              <div>
                <b>{complaint.complaint_code}</b>

                <span>
                  {complaint.problem_report}
                </span>

                <small>
                  {complaint.department_name ||
                    "Pending"}
                  {" · "}
                  {complaint.officer_name ||
                    "No officer"}
                  {" · "}
                  {complaint.citizen_name ||
                    "Unknown citizen"}
                </small>
              </div>

              <Badge
                tone={
                  complaint.ai_status ===
                  "REVIEW_REQUIRED"
                    ? "red"
                    : Number(
                        complaint.priority_score
                      ) >= 80
                    ? "red"
                    : "default"
                }
              >
                {String(
                  complaint.status || "UNKNOWN"
                ).replaceAll("_", " ")}
              </Badge>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}


/* =========================
   ANALYTICS
========================= */

function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      try {
        const result = await api.get(
          "/admin/analytics"
        );

        if (mounted) {
          setData({
            avgResolutionHours:
              result.avgResolutionHours ?? 0,

            byDepartment:
              Array.isArray(result.byDepartment)
                ? result.byDepartment
                : [],

            byStatus:
              Array.isArray(result.byStatus)
                ? result.byStatus
                : [],

            byType:
              Array.isArray(result.byType)
                ? result.byType
                : [],
          });
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Failed to load analytics."
          );

          setData({
            avgResolutionHours: 0,
            byDepartment: [],
            byStatus: [],
            byType: [],
          });
        }
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, []);

  if (!data) {
    return <Loading />;
  }

  const max = Math.max(
    1,
    ...data.byDepartment.map(
      (item) => Number(item.total) || 0
    )
  );

  return (
    <Card title="Analytics">
      {error && <ErrorBox message={error} />}

      <div className="analytics-kpis">
        <Stat
          label="Average Resolution"
          value={`${data.avgResolutionHours} hrs`}
        />

        <Stat
          label="Problem Types"
          value={data.byType.length}
        />
      </div>

      <h4>Complaints by Department</h4>

      {data.byDepartment.length === 0 ? (
        <Empty text="No department analytics available." />
      ) : (
        data.byDepartment.map((item) => {
          const total = Number(item.total) || 0;
          const width = (total / max) * 100;

          return (
            <div
              className="bar-row"
              key={item.name}
            >
              <span>{item.name}</span>

              <div className="bar">
                <i
                  style={{
                    width: `${width}%`,
                  }}
                />
              </div>

              <b>{total}</b>
            </div>
          );
        })
      )}

      <h4>Complaints by Status</h4>

      <div className="chip-row">
        {data.byStatus.length === 0 ? (
          <Empty text="No status data available." />
        ) : (
          data.byStatus.map((item) => (
            <Badge key={item.status}>
              {String(
                item.status || "UNKNOWN"
              ).replaceAll("_", " ")}
              {" · "}
              {item.count ?? 0}
            </Badge>
          ))
        )}
      </div>
    </Card>
  );
}


/* =========================
   PEOPLE
========================= */

function AdminPeople() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPeople() {
      try {
        const [citizensResult, officersResult] =
          await Promise.all([
            api.get("/admin/citizens"),
            api.get("/admin/officers"),
          ]);

        if (mounted) {
          setData({
            citizens: Array.isArray(
              citizensResult.citizens
            )
              ? citizensResult.citizens
              : [],

            officers: Array.isArray(
              officersResult.officers
            )
              ? officersResult.officers
              : [],
          });
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Failed to load people."
          );

          setData({
            citizens: [],
            officers: [],
          });
        }
      }
    }

    loadPeople();

    return () => {
      mounted = false;
    };
  }, []);

  if (!data) {
    return <Loading />;
  }

  return (
    <div className="dash-grid">
      {error && <ErrorBox message={error} />}

      <Card title="Citizens">
        {data.citizens.length === 0 ? (
          <Empty text="No citizens found." />
        ) : (
          data.citizens
            .slice(0, 20)
            .map((citizen) => (
              <div
                className="case-row"
                key={citizen.id}
              >
                <div>
                  <b>{citizen.full_name}</b>

                  <span>
                    {citizen.email}
                  </span>
                </div>

                <small>
                  {citizen.complaint_count ?? 0}{" "}
                  reports ·{" "}
                  {citizen.resolved_count ?? 0}{" "}
                  resolved · score{" "}
                  {citizen.civic_mind_score ??
                    "—"}
                </small>
              </div>
            ))
        )}
      </Card>

      <Card title="Officers">
        {data.officers.length === 0 ? (
          <Empty text="No officers found." />
        ) : (
          data.officers
            .slice(0, 30)
            .map((officer) => (
              <div
                className="case-row"
                key={officer.id}
              >
                <div>
                  <b>{officer.name}</b>

                  <span>
                    {officer.department_name ||
                      "No department"}
                    {" · "}
                    {officer.login_id}
                  </span>
                </div>

                <small>
                  {officer.open ?? 0} open ·{" "}
                  {officer.resolved ?? 0} resolved
                </small>
              </div>
            ))
        )}
      </Card>
    </div>
  );
}