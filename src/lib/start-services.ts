/**
 * Beulrock Serverside — Services Entry Point
 * 
 * This file starts all the background services:
 * 1. WebSocket Server (ws library on port 3033)
 * 2. BullMQ Execution Worker
 * 
 * It can be run standalone or imported by the Next.js server.
 */

import { startWebSocketServer, stopWebSocketServer } from "./websocket-server";
import { startWorker, stopWorker } from "./bullmq-worker";

let servicesStarted = false;

export async function startAllServices(): Promise<void> {
  if (servicesStarted) return;

  try {
    const wsPort = parseInt(process.env.WS_PORT || "3033", 10);

    // Start WebSocket server
    startWebSocketServer(wsPort);
    console.log("[Services] WebSocket server started");

    // Start BullMQ worker
    try {
      startWorker();
      console.log("[Services] BullMQ worker started");
    } catch (err) {
      console.warn("[Services] BullMQ worker failed to start (Redis may be unavailable):", err);
    }

    servicesStarted = true;
    console.log("[Services] ✅ All services initialized");

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
