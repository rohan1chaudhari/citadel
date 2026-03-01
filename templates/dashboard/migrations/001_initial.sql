-- Initial schema for {{app_id}} app
-- Stores sample data for dashboard visualizations

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- e.g., 'sales', 'users', 'performance'
  label TEXT NOT NULL,    -- e.g., 'Jan 2024', 'Product A'
  value REAL NOT NULL,    -- numeric value
  unit TEXT,              -- e.g., '$', '%', 'users'
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_category ON metrics(category);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);

-- Insert sample data
INSERT INTO metrics (category, label, value, unit, created_at) VALUES
  ('sales', 'Jan', 12000, '$', '2024-01-15T00:00:00Z'),
  ('sales', 'Feb', 19000, '$', '2024-02-15T00:00:00Z'),
  ('sales', 'Mar', 15000, '$', '2024-03-15T00:00:00Z'),
  ('sales', 'Apr', 22000, '$', '2024-04-15T00:00:00Z'),
  ('sales', 'May', 28000, '$', '2024-05-15T00:00:00Z'),
  ('sales', 'Jun', 24000, '$', '2024-06-15T00:00:00Z'),
  ('users', 'Jan', 1200, 'users', '2024-01-15T00:00:00Z'),
  ('users', 'Feb', 1800, 'users', '2024-02-15T00:00:00Z'),
  ('users', 'Mar', 2400, 'users', '2024-03-15T00:00:00Z'),
  ('users', 'Apr', 2900, 'users', '2024-04-15T00:00:00Z'),
  ('users', 'May', 3500, 'users', '2024-05-15T00:00:00Z'),
  ('users', 'Jun', 4200, 'users', '2024-06-15T00:00:00Z'),
  ('performance', 'API Latency', 45, 'ms', '2024-06-15T00:00:00Z'),
  ('performance', 'Uptime', 99.9, '%', '2024-06-15T00:00:00Z'),
  ('performance', 'Error Rate', 0.2, '%', '2024-06-15T00:00:00Z');
