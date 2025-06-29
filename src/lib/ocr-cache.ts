import { supabase } from './supabase';

interface CacheEntry {
  pdfId: string;
  ocrData: any;
  timestamp: number;
  expiresAt: number;
}

class OCRCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  async get(pdfId: string): Promise<any | null> {
    // Check memory cache first
    const memoryEntry = this.cache.get(pdfId);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.ocrData;
    }

    // Check database cache
    try {
      const { data, error } = await supabase
        .from('pdf_ocr_data')
        .select('*')
        .eq('pdf_id', pdfId)
        .order('page_number', { ascending: true });

      if (error) {
        return null;
      }

      if (data && data.length > 0) {
        // Store in memory cache
        const cacheEntry: CacheEntry = {
          pdfId,
          ocrData: data,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.CACHE_DURATION
        };
        this.cache.set(pdfId, cacheEntry);
        
        return data;
      }
    } catch (error) {
      console.error('Error accessing OCR cache:', error);
    }

    return null;
  }

  async set(pdfId: string, ocrData: any): Promise<void> {
    // Store in memory cache
    const cacheEntry: CacheEntry = {
      pdfId,
      ocrData,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_DURATION
    };
    this.cache.set(pdfId, cacheEntry);
  }

  async invalidate(pdfId: string): Promise<void> {
    // Remove from memory cache
    this.cache.delete(pdfId);
    
    // Remove from database cache
    try {
      const { error } = await supabase
        .from('pdf_ocr_data')
        .delete()
        .eq('pdf_id', pdfId);

      if (error) {
        console.error('Error invalidating OCR cache:', error);
      }
    } catch (error) {
      console.error('Error invalidating OCR cache:', error);
    }
  }

  async getStatus(pdfId: string): Promise<{ cached: boolean; processing: boolean; failed: boolean }> {
    try {
      const { data, error } = await supabase
        .from('user_pdfs')
        .select('ocr_status, ocr_processed')
        .eq('id', pdfId)
        .single();

      if (error) {
        return { cached: false, processing: false, failed: true };
      }

      return {
        cached: data.ocr_processed && data.ocr_status === 'completed',
        processing: data.ocr_status === 'processing',
        failed: data.ocr_status === 'failed'
      };
    } catch (error) {
      return { cached: false, processing: false, failed: true };
    }
  }

  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    const active = entries.filter(entry => entry.expiresAt > now);
    const expired = entries.filter(entry => entry.expiresAt <= now);

    return {
      total: entries.length,
      active: active.length,
      expired: expired.length,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
    };
  }
}

// Export singleton instance
export const ocrCache = new OCRCache();

// Helper functions
export async function getCachedOCRData(pdfId: string) {
  return await ocrCache.get(pdfId);
}

export async function setCachedOCRData(pdfId: string, data: any) {
  return await ocrCache.set(pdfId, data);
}

export async function invalidateOCRCache(pdfId: string) {
  return await ocrCache.invalidate(pdfId);
}

export async function getOCRCacheStatus(pdfId: string) {
  return await ocrCache.getStatus(pdfId);
}