// Supabase Configuration Check - Enhanced Version with Better Bucket Detection
import { supabase } from './supabase';

export async function checkSupabaseSetup() {
  const results = {
    connection: false,
    authentication: false,
    storage: false,
    database: false,
    edgeFunction: false,
    bucketDetails: null,
    allBuckets: [],
    errors: [] as string[]
  };

  try {
    // Test basic connection with a simple query
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      results.errors.push(`Database connection error: ${error.message}`);
    } else {
      results.connection = true;
      results.database = true;
    }
  } catch (error) {
    results.errors.push(`Connection failed: ${error.message}`);
  }

  try {
    // Test authentication system
    const { data: { session } } = await supabase.auth.getSession();
    results.authentication = true; // Auth system is working if we can check session
  } catch (error) {
    results.errors.push(`Auth check failed: ${error.message}`);
  }

  try {
    // Enhanced storage bucket check with multiple approaches
    console.log('Checking storage buckets...');
    
    // Method 1: List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Bucket list error:', bucketsError);
      results.errors.push(`Storage bucket list error: ${bucketsError.message}`);
    } else {
      console.log('All available buckets:', buckets);
      results.allBuckets = buckets || [];
      
      // Look for PDF bucket with different approaches
      const pdfBucket = buckets?.find(bucket => 
        bucket.name === 'pdfs' || 
        bucket.id === 'pdfs' ||
        bucket.name.toLowerCase().includes('pdf')
      );
      
      if (pdfBucket) {
        results.storage = true;
        results.bucketDetails = pdfBucket;
        console.log('PDF bucket found:', pdfBucket);
      } else {
        console.log('PDF bucket not found in list, trying direct access...');
        
        // Method 2: Try to directly access the pdfs bucket
        try {
          const { data: files, error: listError } = await supabase.storage
            .from('pdfs')
            .list('', { limit: 1 });
          
          if (!listError) {
            // If we can list files, the bucket exists
            results.storage = true;
            results.bucketDetails = { name: 'pdfs', exists: true, accessible: true };
            console.log('PDF bucket confirmed via direct access');
          } else {
            console.error('Direct bucket access error:', listError);
            results.errors.push(`Cannot access PDF bucket: ${listError.message}`);
          }
        } catch (directError) {
          console.error('Direct bucket access failed:', directError);
          results.errors.push(`Direct bucket access failed: ${directError.message}`);
        }
      }
    }

    // Method 3: Try to get bucket info directly
    if (!results.storage) {
      try {
        const { data: bucketInfo, error: infoError } = await supabase.storage.getBucket('pdfs');
        if (!infoError && bucketInfo) {
          results.storage = true;
          results.bucketDetails = bucketInfo;
          console.log('PDF bucket found via getBucket:', bucketInfo);
        }
      } catch (infoError) {
        console.log('getBucket method not available or failed');
      }
    }

  } catch (error) {
    results.errors.push(`Storage check failed: ${error.message}`);
  }

  try {
    // Enhanced edge function check
    const { data: { session } } = await supabase.auth.getSession();
    
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-pdf-ocr`;
    
    // Test with OPTIONS first (CORS preflight)
    const optionsResponse = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        'Authorization': session ? `Bearer ${session.access_token}` : '',
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Edge function OPTIONS response:', optionsResponse.status, optionsResponse.statusText);
    
    if (optionsResponse.status === 404) {
      results.errors.push('Edge function process-pdf-ocr not found (404 on OPTIONS)');
    } else if (optionsResponse.status === 200 || optionsResponse.status === 204) {
      results.edgeFunction = true;
      console.log('Edge function confirmed via OPTIONS');
    } else {
      // Try a POST request to get more info
      try {
        const postResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': session ? `Bearer ${session.access_token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ test: true })
        });
        
        console.log('Edge function POST response:', postResponse.status, postResponse.statusText);
        
        if (postResponse.status === 404) {
          results.errors.push('Edge function process-pdf-ocr not found (404 on POST)');
        } else {
          // Any response other than 404 means the function exists
          results.edgeFunction = true;
          console.log('Edge function confirmed via POST request');
        }
      } catch (postError) {
        console.error('Edge function POST test error:', postError);
        results.errors.push(`Edge function POST test failed: ${postError.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Edge function check failed: ${error.message}`);
  }

  return results;
}

export async function checkRequiredTables() {
  const requiredTables = ['users', 'user_pdfs', 'pdf_ocr_data'];
  const results = {};

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      results[table] = !error;
      if (error) {
        results[`${table}_error`] = error.message;
      }
    } catch (error) {
      results[table] = false;
      results[`${table}_error`] = error.message;
    }
  }

  return results;
}

export async function checkStoragePolicies() {
  try {
    // Try to list objects in the pdfs bucket (this will test policies)
    const { data, error } = await supabase.storage.from('pdfs').list('', { limit: 1 });
    return {
      canAccess: !error,
      error: error?.message,
      details: data ? `Found ${data.length} items` : 'No items found'
    };
  } catch (error) {
    return {
      canAccess: false,
      error: error.message,
      details: null
    };
  }
}

export async function testFileUpload() {
  try {
    // Create a small test file
    const testContent = 'test file content for bucket verification';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    
    // Try to upload it
    const testPath = `test-${Date.now()}.txt`;
    const { data, error } = await supabase.storage
      .from('pdfs')
      .upload(testPath, testFile);
    
    if (error) {
      return {
        success: false,
        error: error.message,
        details: 'Upload test failed - this indicates bucket or policy issues'
      };
    }
    
    // Clean up the test file
    await supabase.storage.from('pdfs').remove([testPath]);
    
    return {
      success: true,
      message: 'File upload test successful - bucket and policies are working correctly!',
      details: 'This confirms your storage setup is properly configured'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: 'Unexpected error during upload test'
    };
  }
}

export async function verifyBucketExists() {
  try {
    // Multiple verification methods
    const methods = [];
    
    // Method 1: List buckets
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      const found = buckets?.some(b => b.name === 'pdfs');
      methods.push({ method: 'listBuckets', success: !error && found, error: error?.message });
    } catch (e) {
      methods.push({ method: 'listBuckets', success: false, error: e.message });
    }
    
    // Method 2: Direct access
    try {
      const { data, error } = await supabase.storage.from('pdfs').list('', { limit: 1 });
      methods.push({ method: 'directAccess', success: !error, error: error?.message });
    } catch (e) {
      methods.push({ method: 'directAccess', success: false, error: e.message });
    }
    
    // Method 3: Upload test
    try {
      const testFile = new Blob(['test'], { type: 'text/plain' });
      const { data, error } = await supabase.storage.from('pdfs').upload(`test-${Date.now()}.txt`, testFile);
      if (!error) {
        await supabase.storage.from('pdfs').remove([data.path]);
      }
      methods.push({ method: 'uploadTest', success: !error, error: error?.message });
    } catch (e) {
      methods.push({ method: 'uploadTest', success: false, error: e.message });
    }
    
    return {
      exists: methods.some(m => m.success),
      methods,
      recommendation: methods.some(m => m.success) ? 
        'Bucket exists and is accessible' : 
        'Bucket may not exist or has access issues'
    };
  } catch (error) {
    return {
      exists: false,
      methods: [],
      error: error.message,
      recommendation: 'Unable to verify bucket existence'
    };
  }
}