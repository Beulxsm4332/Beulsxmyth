/**
 * Beulrock Serverside — Services Entry Point
 * 
 * This file starts all the background services:
 * 1. WebSocket Server (ws library on port 3033)
 * 2. BullMQ Execution Worker
 * 
 * On Vercel (serverless) these services are NO-OPs because:
 * - Vercel doesn't support long-running processes
 * - WebSocket requires a persistent connection (use Socket.io Cloud or separate backend)
 * - BullMQ workers need persistent Redis connections
 * 
 * For Vercel deployment, WebSocket features gracefully degrade to polling.
 */

import { startWebSocketServer, stopWebSocketServer } from "./websocket-server";
import { startWorker, stopWorker } from "./bullmq-worker";

let servicesStarted = false;

// Detect serverless environment (Vercel, Netlify Functions, etc.)
const isServerless = typeof process.env.VERCEL === 'string' || 
  typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string' ||
  process.env.NODE_ENV === 'production' && !process.env.WS_PORT;

export async function startAllServices(): Promise<void> {
  if (servicesStarted) return;

  // On Vercel/serverless, services are disabled
  if (isServerless) {
    console.log("[Services] Running in serverless mode — WebSocket & BullMQ services disabled (use polling)");
    return;
  }

  try {
    const wsPort = parseInt(process.env.WS_PORT || "3033", 10);

    // Start WebSocket server (async because ws is dynamically loaded)
    const wsServer = await startWebSocketServer(wsPort);
    if (wsServer) {
      console.log("[Services] WebSocket server started");
    } else {
      console.log("[Services] WebSocket server not started (ws module unavailable)");
    }

    // Start BullMQ worker
    try {
      startWorker();
      console.log("[Services] BullMQ worker started");
    } catch (err) {
      console.warn("[Services] BullMQ worker failed to start (Redis may be unavailable):", err);
    }

    servicesStarted = true;
    console.log("[Services] All services initialized");

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[Services] Shutting down...");
      await stopWorker();
      stopWebSocketServer();
      servicesStarted = false;
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("[Services] Failed to start services:", err);
    throw err;
  }
}

// Allow standalone execution
if (require.main === module) {
  startAllServices().catch((err) => {
    console.error("[Services] Fatal error:", err);
    process.exit(1);
  });
}
