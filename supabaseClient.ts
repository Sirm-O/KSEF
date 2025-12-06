import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://bomfaccnllzskhnelwxx.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbWZhY2NubGx6c2tobmVsd3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NzA0ODUsImV4cCI6MjA3NDM0NjQ4NX0.hBLLpFEqNVHlHMS6Sigz2Z9t7vnpvjzooEeeWzsn5Tg';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);