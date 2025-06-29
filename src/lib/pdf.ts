import { supabase } from './supabase';
import { processOCR } from './ocr';
import type { Database } from './supabase';

type PDF = Database['public']['Tables']['user_pdfs']['Row'];
type PDFInsert = Database['public']['Tables']['user_pdfs']['Insert'];

export async function uploadPDF(file: File, userId: string): Promise<{ data: PDF | null; error: string | null }> {
  try {
    // Validate file type and size
    if (file.type !== 'application/pdf') {
      return { data: null, error: 'Only PDF files are allowed' };
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { data: null, error: 'File size must be less than 10MB' };
    }

    // Generate unique file name
    const fileExt = 'pdf';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return { data: null, error: `Upload failed: ${uploadError.message}` };
    }

    // Save file metadata to database
    const pdfData: PDFInsert = {
      user_id: userId,
      file_name: fileName,
      original_name: file.name,
      file_size: file.size,
      file_path: filePath,
      mime_type: file.type,
      ocr_processed: false,
      ocr_status: 'pending'
    };

    const { data, error: dbError } = await supabase
      .from('user_pdfs')
      .insert(pdfData)
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insertion fails
      await supabase.storage.from('pdfs').remove([filePath]);
      return { data: null, error: `Database error: ${dbError.message}` };
    }

    // Start OCR processing
    if (data) {
      try {
        const ocrResult = await processOCR(data.id, filePath);
        
        if (ocrResult.error) {
          // Update status to failed
          await supabase
            .from('user_pdfs')
            .update({ ocr_status: 'failed' })
            .eq('id', data.id);
        }
      } catch (ocrError) {
        // Update status to failed
        await supabase
          .from('user_pdfs')
          .update({ ocr_status: 'failed' })
          .eq('id', data.id);
      }
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: `Unexpected error: ${error.message}` };
  }
}

export async function getUserPDFs(userId: string): Promise<{ data: PDF[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('user_pdfs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function deletePDF(pdfId: string, userId: string): Promise<{ error: string | null }> {
  try {
    // First get the PDF data to find the file path
    const { data: pdf, error: fetchError } = await supabase
      .from('user_pdfs')
      .select('file_path')
      .eq('id', pdfId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      return { error: fetchError.message };
    }

    // Delete OCR data first (will cascade due to foreign key)
    await supabase
      .from('pdf_ocr_data')
      .delete()
      .eq('pdf_id', pdfId);

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('pdfs')
      .remove([pdf.file_path]);

    if (storageError) {
      return { error: `Storage deletion failed: ${storageError.message}` };
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('user_pdfs')
      .delete()
      .eq('id', pdfId)
      .eq('user_id', userId);

    if (dbError) {
      return { error: `Database deletion failed: ${dbError.message}` };
    }

    return { error: null };
  } catch (error) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function downloadPDF(filePath: string): Promise<{ data: Blob | null; error: string | null }> {
  try {
    console.log('Downloading PDF from path:', filePath);
    
    const { data, error } = await supabase.storage
      .from('pdfs')
      .download(filePath);

    if (error) {
      console.error('Storage download error:', error);
      return { data: null, error: `Storage error: ${error.message}` };
    }

    if (!data) {
      return { data: null, error: 'No data received from storage' };
    }

    console.log('PDF downloaded successfully, size:', data.size);
    return { data, error: null };
  } catch (error) {
    console.error('Unexpected download error:', error);
    return { data: null, error: `Unexpected error: ${error.message}` };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getOCRStatusDisplay(status: string): { text: string; color: string } {
  switch (status) {
    case 'pending':
      return { text: 'OCR Pending', color: 'text-yellow-600' };
    case 'processing':
      return { text: 'Processing OCR...', color: 'text-blue-600' };
    case 'completed':
      return { text: 'OCR Complete', color: 'text-green-600' };
    case 'failed':
      return { text: 'OCR Failed', color: 'text-red-600' };
    default:
      return { text: 'Unknown Status', color: 'text-gray-600' };
  }
}