import { createClient } from '@supabase/supabase-js'

// Enhanced environment variable handling with better error messages
function getSupabaseUrl(): string {
  // Try multiple sources for the URL
  const url = import.meta.env.VITE_SUPABASE_URL || 
             (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null) ||
             'https://sumzwmhxnweydjdgdbxc.supabase.co'; // Your actual URL as fallback

  console.log('Supabase URL sources check:');
  console.log('- import.meta.env.VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('- process.env.VITE_SUPABASE_URL:', (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null) ? 'SET' : 'MISSING');
  console.log('- Final URL used:', url);

  return url;
}

function getSupabaseAnonKey(): string {
  // Try multiple sources for the anon key
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 
             (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : null) ||
             'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1bXp3bWh4bndleWRqZGdkYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExODgxOTQsImV4cCI6MjA2Njc2NDE5NH0.FlDjdNPytTpmRH7ZsIfPjZg10FZnkivgGWYLX1wdr0M'; // Your actual key as fallback

  console.log('Supabase Anon Key sources check:');
  console.log('- import.meta.env.VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
  console.log('- process.env.VITE_SUPABASE_ANON_KEY:', (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : null) ? 'SET' : 'MISSING');
  console.log('- Final key length:', key.length);

  return key;
}

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Validate the environment variables
if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_url_here' || 
    supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.error('❌ Supabase configuration error:');
  console.error('- URL:', supabaseUrl);
  console.error('- Key length:', supabaseAnonKey?.length || 0);
  
  // Don't throw error immediately, let the app try to work with fallbacks
  console.warn('⚠️ Using fallback Supabase configuration. Some features may not work correctly.');
}

console.log('✅ Supabase client configuration:');
console.log('- URL:', supabaseUrl);
console.log('- Key length:', supabaseAnonKey.length);

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      user_pdfs: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          original_name: string;
          file_size: number;
          file_path: string;
          mime_type: string;
          ocr_processed: boolean;
          ocr_status: 'pending' | 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          original_name: string;
          file_size: number;
          file_path: string;
          mime_type?: string;
          ocr_processed?: boolean;
          ocr_status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          original_name?: string;
          file_size?: number;
          file_path?: string;
          mime_type?: string;
          ocr_processed?: boolean;
          ocr_status?: 'pending' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
      };
      pdf_ocr_data: {
        Row: {
          id: string;
          pdf_id: string;
          page_number: number;
          extracted_text: string;
          text_blocks: any;
          confidence_score: number;
          processing_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pdf_id: string;
          page_number: number;
          extracted_text?: string;
          text_blocks?: any;
          confidence_score?: number;
          processing_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pdf_id?: string;
          page_number?: number;
          extracted_text?: string;
          text_blocks?: any;
          confidence_score?: number;
          processing_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};