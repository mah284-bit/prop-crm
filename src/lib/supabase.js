// src/lib/supabase.js
// Single Supabase client shared across all components.
// Eliminates "Multiple GoTrueClient instances" warnings and
// auth-token storage-key contention errors.
//
// All components import from this file:
//   import { supabase } from "../lib/supabase";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
