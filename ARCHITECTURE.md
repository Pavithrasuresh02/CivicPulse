# CivicPulse architecture

Citizen → PostgreSQL → Claude analysis → confidence gate → related reports/Civic Issue → deterministic priority → deterministic department/jurisdiction/officer routing → officer action → resolution evidence → citizen verification → badge.

Admin receives global visibility in parallel and can review low-confidence AI cases or reroute cases.

Claude never chooses the final officer. The server owns role, department, jurisdiction, status and priority decisions.
