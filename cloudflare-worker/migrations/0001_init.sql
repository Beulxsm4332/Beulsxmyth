-- Beulrock Edge Worker - D1 Database Schema
-- Game logs, server status, and analytics

CREATE TABLE IF NOT EXISTS game_logs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servers (
  server_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'online',
  cpu_usage REAL,
  memory_usage REAL,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_logs_game_id ON game_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_logs_server_id ON game_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_logs_player_id ON game_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON game_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_servers_game_id ON servers(game_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
