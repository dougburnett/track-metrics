-- Returns the single best result per athlete per metric (respects lower_is_better)
CREATE OR REPLACE FUNCTION best_results(metric_ids uuid[])
RETURNS TABLE(id uuid, athlete_id uuid, metric_id uuid, value numeric) AS $$
  SELECT DISTINCT ON (r.metric_id, r.athlete_id)
    r.id, r.athlete_id, r.metric_id, r.value
  FROM results r
  JOIN metrics m ON m.id = r.metric_id
  WHERE r.metric_id = ANY(metric_ids)
  ORDER BY r.metric_id, r.athlete_id,
    CASE WHEN m.lower_is_better THEN r.value ELSE -r.value END ASC
$$ LANGUAGE sql STABLE;
