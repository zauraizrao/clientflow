import { createClient } from "@supabase/supabase-js";

import { env } from "./env.js";

export const supabaseStorageAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);
