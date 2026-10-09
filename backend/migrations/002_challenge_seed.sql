-- Populate the five civic-decision challenge scenarios and their options.
-- Kept separate from demo-account seeding so production does not need ALLOW_SEED=true.

INSERT INTO challenge_scenarios (position, title, emoji, context, active)
VALUES
  (1, 'Heavy Rainfall', '🌧️', 'Heavy rainfall has affected your area. Which problem would you solve first?', TRUE),
  (2, 'Festival Week', '🎉', 'A big festival starts in 3 days and crowds are expected. What needs attention first?', TRUE),
  (3, 'Summer Heatwave', '☀️', 'Temperatures are above 42°C for a week. Which problem do you tackle first?', TRUE),
  (4, 'Monsoon Fever', '🦟', 'Fever cases are rising after the monsoon. What should be solved first?', TRUE),
  (5, 'Industrial Town', '🏭', 'Residents near an industrial area are worried. Which issue comes first?', TRUE)
ON CONFLICT (position) DO UPDATE
SET title = EXCLUDED.title, emoji = EXCLUDED.emoji, context = EXCLUDED.context, active = EXCLUDED.active;

INSERT INTO challenge_options
  (scenario_id, position, label, emoji, affected_people, severity, health_risk, safety_risk, environmental_risk, urgency, priority_value, rationale)
SELECT s.id, v.option_position, v.label, v.emoji, v.affected_people, v.severity, v.health_risk, v.safety_risk, v.environmental_risk, v.urgency, v.priority_value, v.rationale
FROM (VALUES
  (1, 1, 'Drinking water contamination', '💧', 800, 'HIGH', 'HIGH', 'LOW', 'MEDIUM', 'HIGH', 86.00, 'High health impact and large affected population.'),
  (1, 2, 'Road potholes', '🛣️', 250, 'MEDIUM', 'LOW', 'MEDIUM', 'LOW', 'MEDIUM', 48.00, 'Safety risk, but less immediate health impact.'),
  (1, 3, 'Broken streetlights', '💡', 400, 'MEDIUM', 'NONE', 'MEDIUM', 'NONE', 'MEDIUM', 55.00, 'Moderate safety concern.'),
  (2, 1, 'Overflowing garbage bins near market', '🗑️', 600, 'MEDIUM', 'MEDIUM', 'LOW', 'HIGH', 'MEDIUM', 66.00, 'Hygiene and environmental risk rise with crowds.'),
  (2, 2, 'Power outage around a clinic', '⚡', 300, 'HIGH', 'HIGH', 'MEDIUM', 'NONE', 'HIGH', 82.00, 'Clinic power failure can directly affect patients.'),
  (2, 3, 'Broken bus shelter', '🚏', 400, 'LOW', 'NONE', 'LOW', 'NONE', 'LOW', 26.00, 'Comfort issue with limited risk.'),
  (3, 1, 'No water supply in a dense colony', '🚰', 1200, 'HIGH', 'HIGH', 'LOW', 'LOW', 'HIGH', 88.00, 'Urgent public-health threat during heat.'),
  (3, 2, 'Dark school road', '🔦', 500, 'MEDIUM', 'NONE', 'HIGH', 'NONE', 'MEDIUM', 57.00, 'Important safety issue, but less immediate.'),
  (3, 3, 'Park maintenance', '🌳', 300, 'LOW', 'NONE', 'LOW', 'LOW', 'LOW', 24.00, 'Quality-of-life issue with low urgency.'),
  (4, 1, 'Stagnant water breeding mosquitoes', '🦟', 350, 'HIGH', 'HIGH', 'LOW', 'MEDIUM', 'HIGH', 81.00, 'Public-health risk with a clear preventable cause.'),
  (4, 2, 'Large highway pothole', '🕳️', 2000, 'HIGH', 'NONE', 'HIGH', 'NONE', 'MEDIUM', 68.00, 'Significant road safety risk.'),
  (4, 3, 'Leaking school roof', '🏫', 200, 'MEDIUM', 'LOW', 'MEDIUM', 'LOW', 'MEDIUM', 47.00, 'Disruptive but less widespread.'),
  (5, 1, 'Factory effluent flowing into river', '🏭', 900, 'HIGH', 'HIGH', 'LOW', 'CRITICAL', 'HIGH', 93.00, 'Severe environmental harm plus health risk.'),
  (5, 2, 'Broken bus shelter', '🚏', 600, 'LOW', 'NONE', 'LOW', 'NONE', 'LOW', 25.00, 'Minor inconvenience.'),
  (5, 3, 'Streetlights out in market', '💡', 700, 'MEDIUM', 'NONE', 'MEDIUM', 'NONE', 'MEDIUM', 53.00, 'Moderate safety concern.')
) AS v(scenario_position, option_position, label, emoji, affected_people, severity, health_risk, safety_risk, environmental_risk, urgency, priority_value, rationale)
JOIN challenge_scenarios s ON s.position = v.scenario_position
ON CONFLICT (scenario_id, position) DO UPDATE
SET label = EXCLUDED.label,
    emoji = EXCLUDED.emoji,
    affected_people = EXCLUDED.affected_people,
    severity = EXCLUDED.severity,
    health_risk = EXCLUDED.health_risk,
    safety_risk = EXCLUDED.safety_risk,
    environmental_risk = EXCLUDED.environmental_risk,
    urgency = EXCLUDED.urgency,
    priority_value = EXCLUDED.priority_value,
    rationale = EXCLUDED.rationale;
