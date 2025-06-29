/*
  # PDF Management Schema

  1. New Tables
    - `user_pdfs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `file_name` (text)
      - `original_name` (text)
      - `file_size` (bigint)
      - `file_path` (text)
      - `mime_type` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_pdfs` table
    - Add policies for authenticated users to manage their own PDFs

  3. Storage
    - Create storage bucket for PDF files
    - Set up storage policies for authenticated users
*/

-- Create the user_pdfs table
CREATE TABLE IF NOT EXISTS user_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  original_name text NOT NULL,
  file_size bigint NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_pdfs ENABLE ROW LEVEL SECURITY;

-- Create policies for user_pdfs table
CREATE POLICY "Users can view their own PDFs"
  ON user_pdfs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PDFs"
  ON user_pdfs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PDFs"
  ON user_pdfs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PDFs"
  ON user_pdfs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Authenticated users can upload PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_pdfs_user_id ON user_pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pdfs_created_at ON user_pdfs(created_at DESC);