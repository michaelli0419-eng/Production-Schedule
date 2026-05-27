-- ═══════════════════════════════════════════════════════════════════════════
-- SCM Production Scheduler — Seed Data
-- Run AFTER schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Production Lines ────────────────────────────────────────────────────────

INSERT INTO production_lines (id, name, focus, sort_order, color)
VALUES
  ('L1', 'Line 1', 'Pods + classrooms',  1, '#3b82f6'),
  ('L2', 'Line 2', 'Classroom wings',    2, '#10b981'),
  ('L3', 'Line 3', 'Admin + specialty',  3, '#f59e0b'),
  ('L4', 'Line 4', 'Final assembly',     4, '#ef4444'),
  ('QUEUE', 'Queue', 'Unscheduled',      5, '#94a3b8')
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  focus      = EXCLUDED.focus,
  sort_order = EXCLUDED.sort_order,
  color      = EXCLUDED.color;

-- Jobs are populated via the Excel sync server (npm run dev:excel → Sync Excel)
-- or manually added in the scheduler app.
