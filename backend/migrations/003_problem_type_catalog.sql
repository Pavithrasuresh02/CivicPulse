-- Populate the production catalog required by the Report a Problem form.
-- Safe to re-run: no demo users, officers, or admin accounts are created.

INSERT INTO departments (code, name, active) VALUES
  ('WATER', 'Water & Sanitation', TRUE),
  ('ROADS', 'Roads', TRUE),
  ('WASTE', 'Waste Management', TRUE),
  ('ELECTRICITY', 'Electricity', TRUE),
  ('HEALTH', 'Public Health', TRUE),
  ('ENVIRONMENT', 'Environment', TRUE),
  ('TRANSPORT', 'Transport', TRUE),
  ('EDUCATION', 'Education', TRUE),
  ('OTHER', 'Other / General Administration', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = TRUE;

INSERT INTO problem_types (code, name, active) VALUES
  ('DRINKING_WATER', 'Drinking Water', TRUE),
  ('SEWAGE_DRAINAGE', 'Sewage & Drainage', TRUE),
  ('ROAD_POTHOLE', 'Road Pothole', TRUE),
  ('ROAD_DAMAGE', 'Road / Bridge Damage', TRUE),
  ('GARBAGE', 'Garbage', TRUE),
  ('STREETLIGHT', 'Streetlight', TRUE),
  ('POWER_OUTAGE', 'Power Outage', TRUE),
  ('DISEASE_OUTBREAK', 'Disease Outbreak', TRUE),
  ('ENVIRONMENTAL_POLLUTION', 'Environmental Pollution', TRUE),
  ('TRANSPORT_PROBLEM', 'Transport Problem', TRUE),
  ('SCHOOL_INFRASTRUCTURE', 'School Infrastructure', TRUE),
  ('OTHER', 'Other', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = TRUE;

INSERT INTO department_problem_types (problem_type_id, department_id)
SELECT pt.id, d.id
FROM (VALUES
  ('DRINKING_WATER', 'WATER'),
  ('SEWAGE_DRAINAGE', 'WATER'),
  ('ROAD_POTHOLE', 'ROADS'),
  ('ROAD_DAMAGE', 'ROADS'),
  ('GARBAGE', 'WASTE'),
  ('STREETLIGHT', 'ELECTRICITY'),
  ('POWER_OUTAGE', 'ELECTRICITY'),
  ('DISEASE_OUTBREAK', 'HEALTH'),
  ('ENVIRONMENTAL_POLLUTION', 'ENVIRONMENT'),
  ('TRANSPORT_PROBLEM', 'TRANSPORT'),
  ('SCHOOL_INFRASTRUCTURE', 'EDUCATION'),
  ('OTHER', 'OTHER')
) AS mapping(problem_code, department_code)
JOIN problem_types pt ON pt.code = mapping.problem_code
JOIN departments d ON d.code = mapping.department_code
ON CONFLICT (problem_type_id) DO UPDATE
SET department_id = EXCLUDED.department_id;
