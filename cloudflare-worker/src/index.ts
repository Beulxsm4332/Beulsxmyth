// ═══════════════════════════════════════════════════════════════
// Beulrock - Cloudflare Worker for Game Log Database & Routing
// ═══════════════════════════════════════════════════════════════
// This worker handles:
// 1. Game log storage and retrieval (D1 Database)
// 2. Rate limiting per user/IP
// 3. Game server heartbeat monitoring
// 4. API routing and load balancing
// ═══════════════════════════════════════════════════════════════

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  RATE_LIMITER: { limit: { key: string } };
  BEULROCK_API: string;
  HMAC_SECRET: string;
}

interface GameLog {
  id?: string;
  game_id: string;
  server_id: string;
  player_id: string;
  action: string;
  metadata?: string;
  ip?: string;
  created_at?: string;
}

interface ServerHeartbeat {
  server_id: string;
  game_id: string;
  player_count: number;
  status: string;
  cpu_usage?: number;
  memory_usage?: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.BEULROCK_API || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/health') return handleHealth();
      if (path.startsWith('/api/logs')) return handleGameLogs(request, env, url);
      if (path.startsWith('/api/heartbeat')) return handleHeartbeat(request, env);
      if (path.startsWith('/api/servers')) return handleServers(env, url);
      if (path.startsWith('/api/stats')) return handleStats(env, url);
      if (path.startsWith('/api/route')) return handleRoute(request, env, url);

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', details: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },

  // Scheduled handler for cleanup tasks (runs every minute via Cloudflare Cron Triggers)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Clean up old logs (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('DELETE FROM game_logs WHERE created_at < ?').bind(thirtyDaysAgo).run();

    // Clean up stale heartbeats (offline for > 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await env.DB.prepare(
      "UPDATE servers SET status = 'offline' WHERE last_heartbeat < ?"
    ).bind(fiveMinutesAgo).run();
  },
};

// ── Health Check ──
function handleHealth(): Response {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'beulrock-edge-worker',
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ── Game Logs ──
async function handleGameLogs(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'POST') {
    const body = await request.json() as GameLog;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO game_logs (id, game_id, server_id, player_id, action, metadata, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.game_id,
      body.server_id,
      body.player_id,
      body.action,
      body.metadata || null,
      body.ip || null,
      createdAt
    ).run();

    return new Response(JSON.stringify({ success: true, id, created_at: createdAt }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET: Fetch logs with pagination
  const gameId = url.searchParams.get('game_id');
  const serverId = url.searchParams.get('server_id');
  const playerId = url.searchParams.get('player_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = 'SELECT * FROM game_logs WHERE 1=1';
  const bindings: string[] = [];

  if (gameId) { query += ' AND game_id = ?'; bindings.push(gameId); }
  if (serverId) { query += ' AND server_id = ?'; bindings.push(serverId); }
  if (playerId) { query += ' AND player_id = ?'; bindings.push(playerId); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(String(limit), String(offset));

  const result = await env.DB.prepare(query).bind(...bindings).all<GameLog>();

  return new Response(JSON.stringify({ success: true, data: result.results, count: result.results?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Server Heartbeat ──
async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as ServerHeartbeat;

  // Upsert server status
  await env.DB.prepare(
    `INSERT INTO servers (server_id, game_id, player_count, status, cpu_usage, memory_usage, last_heartbeat)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(server_id) DO UPDATE SET
       player_count = excluded.player_count,
       status = excluded.status,
       cpu_usage = excluded.cpu_usage,
       memory_usage = excluded.memory_usage,
       last_heartbeat = excluded.last_heartbeat`
  ).bind(
    body.server_id,
    body.game_id,
    body.player_count,
    body.status,
    body.cpu_usage || null,
    body.memory_usage || null,
    new Date().toISOString()
  ).run();

  // Cache in KV for fast reads
  await env.KV.put(
    `server:${body.server_id}`,
    JSON.stringify({ ...body, last_heartbeat: new Date().toISOString() }),
    { expirationTtl: 300 }
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Server Status ──
async function handleServers(env: Env, url: URL): Promise<Response> {
  const gameId = url.searchParams.get('game_id');

  // Try KV cache first
  const cacheKey = `servers:${gameId || 'all'}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify({ success: true, cached: true, data: JSON.parse(cached) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = 'SELECT * FROM servers WHERE status != ?';
  const bindings = ['offline'];
  if (gameId) { query += ' AND game_id = ?'; bindings.push(gameId); }

  const result = await env.DB.prepare(query).bind(...bindings).all();

  // Cache for 60 seconds
  await env.KV.put(cacheKey, JSON.stringify(result.results), { expirationTtl: 60 });

  return new Response(JSON.stringify({ success: true, data: result.results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Stats / Analytics ──
async function handleStats(env: Env, url: URL): Promise<Response> {
  const period = url.searchParams.get('period') || '24h';

  let timeFilter: string;
  switch (period) {
    case '1h': timeFilter = "created_at >= datetime('now', '-1 hour')"; break;
    case '24h': timeFilter = "created_at >= datetime('now', '-24 hours')"; break;
    case '7d': timeFilter = "created_at >= datetime('now', '-7 days')"; break;
    case '30d': timeFilter = "created_at >= datetime('now', '-30 days')"; break;
    default: timeFilter = "created_at >= datetime('now', '-24 hours')";
  }

  const totalLogs = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM game_logs WHERE ${timeFilter}`
  ).first<{ count: number }>();

  const totalPlayers = await env.DB.prepare(
    `SELECT COUNT(DISTINCT player_id) as count FROM game_logs WHERE ${timeFilter}`
  ).first<{ count: number }>();

  const activeServers = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM servers WHERE status = 'online'"
  ).first<{ count: number }>();

  return new Response(JSON.stringify({
    success: true,
    period,
    data: {
      total_logs: totalLogs?.count || 0,
      unique_players: totalPlayers?.count || 0,
      active_servers: activeServers?.count || 0,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── API Router / Proxy ──
async function handleRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const target = url.searchParams.get('target');
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing target parameter' }), { status: 400 });
  }

  // Proxy request to main Beulrock API
  const targetUrl = `${env.BEULROCK_API}/${target}`;
  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.arrayBuffer() : undefined,
    });

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream unavailable' }), { status: 502 });
  }
}
