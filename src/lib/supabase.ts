import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pfvfjuvthywxcmzojgyd.supabase.co';
const supabaseAnonKey = 'sb_publishable_t7DC5zkWmuQZUMt25OOGYQ_5MIzOTAT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
