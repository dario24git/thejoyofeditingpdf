import { supabase } from './supabase';

export async function createStorageBucket() {
  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return { success: false, error: listError.message };
    }

    const existingBucket = buckets?.find(bucket => bucket.name === 'pdfs');
    
    if (existingBucket) {
      console.log('PDF storage bucket already exists');
      return { success: true, message: 'Bucket already exists' };
    }

    // Create the bucket
    const { data, error } = await supabase.storage.createBucket('pdfs', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['application/pdf']
    });

    if (error) {
      console.error('Error creating bucket:', error);
      return { success: false, error: error.message };
    }

    console.log('PDF storage bucket created successfully');
    return { success: true, data };

  } catch (error) {
    console.error('Unexpected error creating bucket:', error);
    return { success: false, error: error.message };
  }
}

export async function setupStoragePolicies() {
  try {
    // The policies should be created via SQL migrations
    // This function can be used to verify they exist
    const { data, error } = await supabase.storage.from('pdfs').list('', { limit: 1 });
    
    if (error && error.message.includes('policy')) {
      return { success: false, error: 'Storage policies not properly configured' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}