// ═══════════════════════════════════════════════════════════════
// Beulrock - Supabase Client Configuration
// ═══════════════════════════════════════════════════════════════
// Production-ready Supabase integration for:
// - Authentication (email/password, magic links, OAuth)
// - Database (PostgreSQL)
// - Realtime subscriptions
// - Storage (file uploads)
// - Edge Functions
// ═══════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton pattern for client-side
let browserClient: SupabaseClient | null = null;

/**
 * Get browser/client-side Supabase client
 * Uses anon key for Row Level Security
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (browserClient) return browserClient;

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

/**
 * Get server-side Supabase client
 * Uses service role key for admin operations (bypasses RLS)
 * ONLY use on the server side!
 */
export function getSupabaseServer(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// ── Supabase SQL Migrations (for setup) ──
// Run these in the Supabase SQL Editor to set up tables

export const SUPABASE_MIGRATIONS = `
-- ============================================
-- Beulrock Supabase Database Schema
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  roblox_username TEXT UNIQUE,
  roblox_id TEXT,
  roblox_avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Whitelist entries
CREATE TABLE IF NOT EXISTS public.whitelist_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roblox_username TEXT NOT NULL UNIQUE,
  roblox_id TEXT,
  roblox_avatar TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'key', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  redeemed_key_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Redeem keys
CREATE TABLE IF NOT EXISTS public.redeem_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'premium')),
  description TEXT NOT NULL DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_expired BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Game logs (high-volume, consider TimescaleDB for scale)
CREATE TABLE IF NOT EXISTS public.game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions (for multi-device tracking)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_info JSONB,
  ip_address INET,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_user ON public.whitelist_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_roblox ON public.whitelist_entries(roblox_username);
CREATE INDEX IF NOT EXISTS idx_game_logs_game ON public.game_logs(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_logs_server ON public.game_logs(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_logs_player ON public.game_logs(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_logs_created ON public.game_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON public.analytics_events(event, created_at DESC);

-- ── Row Level Security (RLS) ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles: Public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Whitelist: users can read own, admins can read/write all
CREATE POLICY "Whitelist: Read own" ON public.whitelist_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Whitelist: Admin all" ON public.whitelist_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'admin')
);

-- Redeem keys: admins only
CREATE POLICY "Keys: Admin only" ON public.redeem_keys FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'admin')
);

-- Game logs: admins can read, service role can write
CREATE POLICY "GameLogs: Admin read" ON public.game_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier IN ('admin', 'premium'))
);
CREATE POLICY "GameLogs: Service insert" ON public.game_logs FOR INSERT WITH CHECK (true);

-- Analytics: admins can read, users can write own
CREATE POLICY "Analytics: Read admin" ON public.analytics_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'admin')
);
CREATE POLICY "Analytics: Write own" ON public.analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Triggers ──
-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
`;
