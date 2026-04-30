import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spatoeqjefkygbiezvgk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYXRvZXFqZWZreWdiaWV6dmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Nzc3NjksImV4cCI6MjA5MzE1Mzc2OX0.r6hQNk_iOhU2zlRvgjSUGn7Fi8x8FY800RrR6uCdsNU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
