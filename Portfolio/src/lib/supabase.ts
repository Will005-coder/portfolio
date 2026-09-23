import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// ─── Table types ─────────────────────────────────────────────────────────────

export interface SiteContentRow {
  id: string;        // e.g. "hero", "project__byu-reu", "contact"
  section: string;   // e.g. "hero", "project", "skills", "contact"
  data: Record<string, unknown>;
  updated_at: string;
}

export interface DesignTokenRow {
  id: string;        // always "tokens"
  tokens: Record<string, string>;
  updated_at: string;
}
