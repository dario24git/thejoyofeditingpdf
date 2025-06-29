/*
  # Add OCR data storage for PDF text extraction

  1. New Tables
    - `pdf_ocr_data`
      - `id` (uuid, primary key)
      - `pdf_id` (uuid, foreign key to user_pdfs)
      - `page_number` (integer)
      - `extracted_text` (text)
      - `text_blocks` (jsonb) - stores text blocks with position data
      - `confidence_score` (decimal)
      - `processing_status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pdf_ocr_data` table
    - Add policies for authenticated users to access their own OCR data

  3. Changes
    - Add `ocr_processed` boolean column to `user_pdfs` table
    - Add `ocr_status` enum column to track processing status
*/

-- Create enum for OCR processing status
CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Add OCR-related columns to user_pdfs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_pdfs' AND column_name = 'ocr_processed'
  ) THEN
    ALTER TABLE user_pdfs ADD COLUMN ocr_processed boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_pdfs' AND column_name = 'ocr_status'
  ) THEN
    ALTER TABLE user_pdfs ADD COLUMN ocr_status ocr_status DEFAULT 'pending';
  END IF;
END $$;

-- Create OCR data table
CREATE TABLE IF NOT EXISTS pdf_ocr_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id uuid NOT NULL REFERENCES user_pdfs(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  extracted_text text,
  text_blocks jsonb,
  confidence_score decimal(5,4),
  processing_status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pdf_ocr_data ENABLE ROW LEVEL SECURITY;

-- Create policies for OCR data
CREATE POLICY "Users can read their own OCR data"
  ON pdf_ocr_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_pdfs 
      WHERE user_pdfs.id = pdf_ocr_data.pdf_id 
      AND user_pdfs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own OCR data"
  ON pdf_ocr_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_pdfs 
      WHERE user_pdfs.id = pdf_ocr_data.pdf_id 
      AND user_pdfs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own OCR data"
  ON pdf_ocr_data
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_pdfs 
      WHERE user_pdfs.id = pdf_ocr_data.pdf_id 
      AND user_pdfs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_pdfs 
      WHERE user_pdfs.id = pdf_ocr_data.pdf_id 
      AND user_pdfs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own OCR data"
  ON pdf_ocr_data
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_pdfs 
      WHERE user_pdfs.id = pdf_ocr_data.pdf_id 
      AND user_pdfs.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_ocr_data_pdf_id ON pdf_ocr_data (pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_ocr_data_page_number ON pdf_ocr_data (pdf_id, page_number);
CREATE INDEX IF NOT EXISTS idx_user_pdfs_ocr_status ON user_pdfs (ocr_status);