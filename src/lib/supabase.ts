import { createClient } from '@supabase/supabase-js'

// In Astro, we need to handle environment variables differently
// Check both import.meta.env and process.env for compatibility
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                   (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null) ||
                   'https://sumzwmhxnweydjdgdbxc.supabase.co'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                       (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : null) ||
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1bXp3bWh4bndleWRqZGdkYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExODgxOTQsImV4cCI6MjA2Njc2NDE5NH0.FlDjdNPytTpmRH7ZsIfPjZg10FZnkivgGWYLX1wdr0M'

if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_url_here' || 
    supabaseAnonKey === 'your_supabase_anon_key_here') {
  throw new Error('Missing or invalid Supabase environment variables. Please check your .env file.')
}

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