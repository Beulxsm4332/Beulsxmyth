export const WHITELIST_TIERS = {
  free: { maxGames: 10, minPlayers: 1, maxPlayers: 10, label: "Free" },
  basic: { maxGames: 100, minPlayers: 1, maxPlayers: 1000, label: "Basic" },
  premium: { maxGames: 1000, minPlayers: 1, maxPlayers: 10000, label: "Premium" },
  ultimate: { maxGames: 10000, minPlayers: 1, maxPlayers: 50000, label: "Ultimate" },
  admin: { maxGames: Infinity, minPlayers: 0, maxPlayers: Infinity, label: "Admin" },
} as const;

export type TierKey = keyof typeof WHITELIST_TIERS;

export function canAccessServer(
  userTier: TierKey,
  playerCount: number
): boolean {
  const tier = WHITELIST_TIERS[userTier];
  return playerCount >= tier.minPlayers && playerCount <= tier.maxPlayers;
}

export function canAccessMoreGames(
  userTier: TierKey,
  currentGameCount: number
): boolean {
  const tier = WHITELIST_TIERS[userTier];
  return currentGameCount < tier.maxGames;
}

export function getTierLabel(tier: TierKey): string {
  return WHITELIST_TIERS[tier]?.label || "Free";
}

export function getTierLimits(tier: TierKey) {
  return WHITELIST_TIERS[tier] || WHITELIST_TIERS.free;
}

export function getUpgradeMessage(tier: TierKey): string {
  const messages: Record<TierKey, string> = {
    free: "Upgrade to Basic to access servers with up to 1,000 players",
    basic: "Upgrade to Premium to access servers with up to 10,000 players",
    premium: "Upgrade to Ultimate to access servers with up to 50,000 players",
    ultimate: "You have the highest tier with maximum access",
    admin: "You have unlimited admin access",
  };
  return messages[tier];
}

export function getNextTier(tier: TierKey): TierKey | null {
  const progression: TierKey[] = ["free", "basic", "premium", "ultimate", "admin"];
  const idx = progression.indexOf(tier);
  if (idx < progression.length - 1) return progression[idx + 1];
  return null;
}

// Script validation
const BLOCKED_PATTERNS = [
  /while\s+true\s+do/i,
  /for\s+i\s*=\s*1\s*,\s*math\.huge/i,
  /spawn\s*\(/i,
];

export function validateScript(script: string): { valid: boolean; reason?: string } {
  if (!script || script.trim().length === 0) {
    return { valid: false, reason: "Script cannot be empty" };
  }

  if (script.length > 100000) {
    return { valid: false, reason: "Script exceeds maximum size of 100KB" };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(script)) {
      return { valid: false, reason: `Script contains blocked pattern: ${pattern.source}` };
    }
  }

  return { valid: true };
}
