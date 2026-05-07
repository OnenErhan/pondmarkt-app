import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[stocktrack] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil. .env.local dosyasını oluşturun.',
  );
}

export const supabase = createClient(url ?? 'http://placeholder', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
