// supabase.ts
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://glmghjrrnhylztzgxomm.supabase.co'; // 替换为你的真实 URL
const supabaseAnonKey = 'sb_publishable_gNbfMJdUtL1xhJ15cxAtww_lVzb8qeI'; // 替换为你的真实 Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);