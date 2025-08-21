import { createClient } from "https://esm.sh/@supabase/supabase-js";

// REEMPLAZA con tus credenciales de Supabase
const SUPABASE_URL = "https://fnisxjsvcyjzzpuqvvtp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaXN4anN2Y3lqenpwdXF2dnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTczMDYsImV4cCI6MjA3MTI5MzMwNn0.aFX2kib1bIzzl2q3PnlFZ0iN-O8kAkqXahVb3ZZ3zhg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
