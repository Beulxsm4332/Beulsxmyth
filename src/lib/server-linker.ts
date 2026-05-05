import crypto from "crypto";

const LINKER_SECRET = process.env.LINKER_SECRET || "beulrock_linker_hmac_secret_key_2024";
const ANTI_REPLAY_WINDOW = 30000; // 30 seconds

interface LinkerRequest {
  serverId: string;
  script: string;
  gameId: string;
  tier: string;
  jobId: string;
}

interface LinkerResponse {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Server Linker Protocol — HMAC-SHA256 signed communication
 * 
 * This module handles the secure communication between the Beulrock
 * control plane and the game server linkers. Every request is signed
 * with HMAC-SHA256 and includes a timestamp for anti-replay protection.
 */
export async function sendToLinker(request: LinkerRequest): Promise<LinkerResponse> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();

  // Construct the canonical request string for signing
  const canonicalRequest = [
    request.serverId,
    request.gameId,
    request.jobId,
    timestamp,
    nonce,
  ].join(":");

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac("sha256", LINKER_SECRET)
    .update(canonicalRequest)
    .digest("hex");

  try {
    // In production, this would send to the actual game server linker
    // For now, we simulate the linker response
    const simulatedResponse = await simulateLinkerResponse(request, {
      "X-Beulrock-Signature": signature,
      "X-Beulrock-Timestamp": timestamp,
      "X-Beulrock-Nonce": nonce,
    });

    return simulatedResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Linker communication failed";
    console.error(`[Linker] Error for ${request.serverId}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Verify incoming requests from linkers (for webhook callbacks)
 */
export function verifyLinkerSignature(params: {
  signature: string;
  timestamp: string;
  nonce: string;
  serverId: string;
  gameId: string;
  jobId: string;
}): { valid: boolean; reason?: string } {
  const { signature, timestamp, nonce, serverId, gameId, jobId } = params;

  // Check anti-replay window
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(requestTime) || Math.abs(now - requestTime) > ANTI_REPLAY_WINDOW) {
    return { valid: false, reason: "Request timestamp outside acceptable window" };
  }

  // Reconstruct canonical request
  const canonicalRequest = [serverId, gameId, jobId, timestamp, nonce].join(":");

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac("sha256", LINKER_SECRET)
    .update(canonicalRequest)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    )
  ) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Simulate linker response for development/demo purposes
 * In production, this would be replaced with actual HTTP/WebSocket calls
 * to the game server linker processes.
 */
async function simulateLinkerResponse(
  request: LinkerRequest,
  _headers: Record<string, string>
): Promise<LinkerResponse> {
  // Simulate network latency (50-200ms)
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));

  // 95% success rate simulation
  const success = Math.random() > 0.05;

  if (success) {
    const outputs = [
      "Auto-farm module loaded. Collecting resources...",
      "Script injected successfully. Running main loop...",
      "ESP module active. Rendering overlays...",
      "Speed hack applied. Movement modified...",
      "Teleport module ready. Destination set...",
      "God mode enabled. Health locked at maximum...",
    ];

    return {
      success: true,
      output: outputs[Math.floor(Math.random() * outputs.length)],
    };
  }

  return {
    success: false,
    error: "Server linker timeout — game server may be unreachable",
  };
}

/**
 * Generate a signed callback URL for the linker to report back to
 */
export function generateCallbackUrl(jobId: string, serverId: string): string {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();

  const canonicalRequest = [serverId, "callback", jobId, timestamp, nonce].join(":");
  const signature = crypto
    .createHmac("sha256", LINKER_SECRET)
    .update(canonicalRequest)
    .digest("hex");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    jobId,
    serverId,
    timestamp,
    nonce,
    signature,
  });

  return `${baseUrl}/api/linker/callback?${params.toString()}`;
}
