import { supabase } from './supabase';
import { getCachedOCRData, getOCRCacheStatus } from './ocr-cache';

export interface TextBlock {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  pageNumber: number;
}

export interface OCRData {
  id: string;
  pdf_id: string;
  page_number: number;
  extracted_text: string;
  text_blocks: TextBlock[];
  confidence_score: number;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || 
         (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null) ||
         'https://sumzwmhxnweydjdgdbxc.supabase.co';
}

export async function processOCR(pdfId: string, filePath: string): Promise<{ error: string | null }> {
  try {
    // Check if already cached or processing
    const cacheStatus = await getOCRCacheStatus(pdfId);
    
    if (cacheStatus.cached) {
      return { error: null };
    }

    if (cacheStatus.processing) {
      return { error: null };
    }

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { error: 'User not authenticated' };
    }

    const supabaseUrl = getSupabaseUrl();
    const apiUrl = `${supabaseUrl}/functions/v1/process-pdf-ocr`;

    // Test if the function exists first
    try {
      const testResponse = await fetch(apiUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (testResponse.status === 404) {
        return { error: 'OCR service is not available. The Edge function needs to be deployed.' };
      }
    } catch (testError) {
      return { error: `OCR service test failed: ${testError.message}` };
    }

    // Make the actual OCR request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdfId, filePath })
    });

    // Check if the response is HTML (likely an error page)
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('text/html')) {
      return { error: 'OCR service returned an unexpected HTML response. Check edge function deployment.' };
    }

    if (!response.ok) {
      let errorMessage = 'OCR processing failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = `OCR processing failed: ${response.status} ${response.statusText}`;
      }
      return { error: errorMessage };
    }

    // Parse successful response
    try {
      const result = await response.json();
      return { error: null };
    } catch (parseError) {
      return { error: 'Invalid response from OCR service' };
    }

  } catch (error) {
    return { error: `An unexpected error occurred during OCR processing: ${error.message}` };
  }
}

export async function getOCRData(pdfId: string): Promise<{ data: OCRData[] | null; error: string | null }> {
  try {
    // Try cache first
    const cachedData = await getCachedOCRData(pdfId);
    if (cachedData) {
      return { data: cachedData, error: null };
    }

    // Fallback to direct database query
    const { data, error } = await supabase
      .from('pdf_ocr_data')
      .select('*')
      .eq('pdf_id', pdfId)
      .order('page_number', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function getOCRStatus(pdfId: string): Promise<{ status: string | null; processed: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('user_pdfs')
      .select('ocr_status, ocr_processed')
      .eq('id', pdfId)
      .single();

    if (error) {
      return { status: null, processed: false, error: error.message };
    }

    return { 
      status: data.ocr_status, 
      processed: data.ocr_processed || false, 
      error: null 
    };
  } catch (error) {
    return { status: null, processed: false, error: 'An unexpected error occurred' };
  }
}

export function extractTextFromBlocks(textBlocks: TextBlock[]): string {
  return textBlocks
    .sort((a, b) => {
      // Sort by page first, then by vertical position (y), then by horizontal position (x)
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      if (Math.abs(a.boundingBox.y - b.boundingBox.y) > 10) {
        return a.boundingBox.y - b.boundingBox.y;
      }
      return a.boundingBox.x - b.boundingBox.x;
    })
    .map(block => block.text)
    .join(' ');
}

export function findTextBlocksInRegion(
  textBlocks: TextBlock[], 
  region: { x: number; y: number; width: number; height: number },
  pageNumber?: number
): TextBlock[] {
  return textBlocks.filter(block => {
    if (pageNumber && block.pageNumber !== pageNumber) {
      return false;
    }

    const blockBox = block.boundingBox;
    
    // Check if the block overlaps with the region
    return !(
      blockBox.x + blockBox.width < region.x ||
      blockBox.x > region.x + region.width ||
      blockBox.y + blockBox.height < region.y ||
      blockBox.y > region.y + region.height
    );
  });
}