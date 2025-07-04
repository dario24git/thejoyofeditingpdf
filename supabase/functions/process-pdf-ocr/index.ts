import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OCRRequest {
  pdfId: string;
  filePath: string;
}

interface TextBlock {
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

Deno.serve(async (req) => {
  console.log('=== OCR EDGE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders })
  }

  // Declare variables outside try block to access in catch block
  let pdfId: string | undefined;
  let user: any;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:');
    console.log('- SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client initialized');

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header:', authHeader ? 'PRESENT' : 'MISSING');
    
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);

    // Verify the user
    console.log('Verifying user token...');
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!authUser) {
      console.error('No user found from token');
      throw new Error('User not found');
    }

    // Assign user to outer scope variable
    user = authUser;
    console.log('User authenticated:', user.id, user.email);

    // Parse request body
    console.log('Parsing request body...');
    let requestBody: OCRRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }
    
    const { pdfId: requestPdfId, filePath } = requestBody;
    pdfId = requestPdfId;

    console.log('Request data:');
    console.log('- PDF ID:', pdfId);
    console.log('- File Path:', filePath);

    if (!pdfId || !filePath) {
      throw new Error('Missing required parameters: pdfId and filePath are required');
    }

    // Verify the PDF belongs to the user
    console.log('Verifying PDF ownership...');
    const { data: pdfData, error: pdfError } = await supabaseClient
      .from('user_pdfs')
      .select('id, user_id, file_path')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single();

    if (pdfError) {
      console.error('PDF verification error:', pdfError);
      throw new Error(`PDF not found or access denied: ${pdfError.message}`);
    }

    console.log('PDF verified:', pdfData);

    // Update OCR status to processing
    console.log('Updating OCR status to processing...');
    const { error: updateError } = await supabaseClient
      .from('user_pdfs')
      .update({ ocr_status: 'processing' })
      .eq('id', pdfId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating OCR status:', updateError);
      throw new Error(`Failed to update OCR status: ${updateError.message}`);
    }

    console.log('OCR status updated to processing');

    // Download the PDF file from Supabase Storage
    console.log('Downloading PDF from storage...');
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('pdfs')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    console.log('PDF downloaded successfully, size:', fileData.size);

    // Convert file to base64 for Google Cloud API - FIXED APPROACH
    console.log('Converting file to base64...');
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Use a more reliable base64 conversion method
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 using a more reliable method
    let base64Content = '';
    
    // Method 1: Try using built-in btoa with proper string conversion
    try {
      // Convert bytes to binary string first
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      // Then convert to base64
      base64Content = btoa(binaryString);
      console.log('Base64 conversion successful using binary string method');
      
    } catch (btoaError) {
      console.error('btoa method failed:', btoaError);
      
      // Method 2: Fallback to manual base64 encoding
      const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      
      for (let i = 0; i < uint8Array.length; i += 3) {
        const a = uint8Array[i];
        const b = uint8Array[i + 1] || 0;
        const c = uint8Array[i + 2] || 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += base64Chars.charAt((bitmap >> 18) & 63);
        result += base64Chars.charAt((bitmap >> 12) & 63);
        result += i + 1 < uint8Array.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
        result += i + 2 < uint8Array.length ? base64Chars.charAt(bitmap & 63) : '=';
      }
      
      base64Content = result;
      console.log('Base64 conversion successful using manual method');
    }

    console.log('File converted to base64, length:', base64Content.length);
    console.log('Base64 starts with:', base64Content.substring(0, 50));
    console.log('Base64 ends with:', base64Content.substring(base64Content.length - 50));

    // Process with Google Cloud Document AI or Vision API
    console.log('Starting OCR processing...');
    const ocrResults = await processWithGoogleCloud(base64Content);

    console.log('OCR processing completed, results:', ocrResults.length, 'pages');

    // Save OCR results to database
    console.log('Saving OCR results to database...');
    for (const result of ocrResults) {
      console.log(`Saving page ${result.pageNumber} with ${result.textBlocks.length} text blocks`);
      
      const { error: insertError } = await supabaseClient
        .from('pdf_ocr_data')
        .insert({
          pdf_id: pdfId,
          page_number: result.pageNumber,
          extracted_text: result.text,
          text_blocks: result.textBlocks,
          confidence_score: result.confidence,
          processing_status: 'completed'
        });

      if (insertError) {
        console.error('Error inserting OCR data for page', result.pageNumber, ':', insertError);
        throw new Error(`Failed to save OCR data for page ${result.pageNumber}: ${insertError.message}`);
      }
    }

    // Update PDF record to mark OCR as completed
    console.log('Updating PDF record to completed...');
    const { error: completeError } = await supabaseClient
      .from('user_pdfs')
      .update({ 
        ocr_processed: true,
        ocr_status: 'completed'
      })
      .eq('id', pdfId)
      .eq('user_id', user.id);

    if (completeError) {
      console.error('Error updating completion status:', completeError);
      throw new Error(`Failed to update completion status: ${completeError.message}`);
    }

    console.log('=== OCR PROCESSING COMPLETED SUCCESSFULLY ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OCR processing completed successfully',
        pagesProcessed: ocrResults.length,
        pdfId: pdfId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('=== OCR PROCESSING ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    // Update OCR status to failed using already parsed variables
    try {
      if (pdfId && user) {
        console.log('Updating OCR status to failed for PDF:', pdfId);
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabaseClient
          .from('user_pdfs')
          .update({ ocr_status: 'failed' })
          .eq('id', pdfId)
          .eq('user_id', user.id);
          
        console.log('OCR status updated to failed');
      }
    } catch (updateError) {
      console.error('Failed to update OCR status to failed:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'OCR processing failed',
        details: 'Check the function logs for more information',
        pdfId: pdfId || 'unknown'
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function processWithGoogleCloud(base64Content: string) {
  console.log('=== PROCESSING WITH GOOGLE CLOUD ===');
  
  // Check for Google Cloud configuration
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us';
  const processorId = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');

  console.log('Google Cloud configuration:');
  console.log('- Project ID:', projectId ? 'SET' : 'MISSING');
  console.log('- Location:', location);
  console.log('- Processor ID:', processorId ? 'SET' : 'MISSING');
  console.log('- Service Account JSON:', serviceAccountJson ? 'SET (length: ' + (serviceAccountJson?.length || 0) + ')' : 'MISSING');
  console.log('- API Key:', apiKey ? 'SET (length: ' + (apiKey?.length || 0) + ')' : 'MISSING');

  // Try Document AI first if we have service account and processor ID
  if (projectId && processorId && serviceAccountJson) {
    console.log('Using Google Cloud Document AI with service account');
    try {
      return await processWithDocumentAI(base64Content, projectId, location, processorId, serviceAccountJson);
    } catch (docAIError) {
      console.error('Document AI failed, falling back to Vision API:', docAIError);
      
      // If Document AI fails but we have API key, try Vision API
      if (apiKey) {
        console.log('Falling back to Vision API...');
        return await processWithVisionAPI(base64Content, apiKey);
      }
      
      throw docAIError;
    }
  }
  
  // Fallback to Vision API if we have API key
  if (apiKey) {
    console.log('Using Google Cloud Vision API with API key');
    return await processWithVisionAPI(base64Content, apiKey);
  }

  throw new Error('Missing Google Cloud configuration. Please set either:\n' +
    '1. GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, and GOOGLE_SERVICE_ACCOUNT_JSON for Document AI, or\n' +
    '2. GOOGLE_CLOUD_API_KEY for Vision API');
}

async function processWithDocumentAI(base64Content: string, projectId: string, location: string, processorId: string, serviceAccountJson: string) {
  console.log('=== PROCESSING WITH DOCUMENT AI ===');
  
  try {
    // Parse service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('Service account parsed successfully');
      console.log('- Client email:', serviceAccount.client_email);
      console.log('- Project ID from SA:', serviceAccount.project_id);
    } catch (parseError) {
      console.error('Failed to parse service account JSON:', parseError);
      throw new Error('Invalid service account JSON format');
    }

    // Get access token using service account
    console.log('Getting access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

    // Document AI endpoint
    const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

    const requestBody = {
      rawDocument: {
        content: base64Content,
        mimeType: 'application/pdf'
      }
    };

    console.log('Making request to Document AI...');
    console.log('Endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Document AI response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Document AI error response:', errorText);
      throw new Error(`Document AI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Document AI response received successfully');
    
    // Process the Document AI response
    return parseDocumentAIResponse(result);

  } catch (error) {
    console.error('Document AI processing failed:', error);
    throw error;
  }
}

async function processWithVisionAPI(base64Content: string, apiKey: string) {
  console.log('=== PROCESSING WITH VISION API ===');
  
  // Use Google Cloud Vision API for document text detection
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const requestBody = {
    requests: [
      {
        image: {
          content: base64Content
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }
        ]
      }
    ]
  };

  console.log('Making request to Vision API...');
  console.log('Endpoint (without key):', endpoint.replace(/key=.*/, 'key=***'));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log('Vision API response:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vision API error response:', errorText);
    throw new Error(`Google Cloud Vision API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Vision API response received successfully');
  
  // Check for API errors
  if (result.responses && result.responses[0] && result.responses[0].error) {
    const apiError = result.responses[0].error;
    console.error('Vision API returned error:', apiError);
    throw new Error(`Vision API error: ${apiError.message || 'Unknown error'}`);
  }

  // Process the Vision API response
  return parseVisionAPIResponse(result);
}

// Proper JWT creation for Google Cloud service account authentication
async function getAccessToken(serviceAccount: any): Promise<string> {
  console.log('Creating JWT for Google Cloud authentication...');
  
  try {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour
    
    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    // Create JWT payload
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Import the private key for signing
    const privateKeyPem = serviceAccount.private_key;
    if (!privateKeyPem) {
      throw new Error('No private key found in service account');
    }

    // Convert PEM to proper format for Web Crypto API
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = privateKeyPem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    // Decode base64 to get the key data
    const keyData = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );

    const encodedSignature = base64UrlEncode(new Uint8Array(signature));
    const jwt = `${signingInput}.${encodedSignature}`;

    console.log('JWT created successfully');

    // Exchange JWT for access token
    const tokenRequest = {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    };

    console.log('Exchanging JWT for access token...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);
      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    console.log('Access token received successfully');
    
    return tokenData.access_token;
    
  } catch (error) {
    console.error('Access token creation failed:', error);
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

function base64UrlEncode(data: string | Uint8Array): string {
  let base64;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    // Convert Uint8Array to string safely
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }
    base64 = btoa(binaryString);
  }
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function parseDocumentAIResponse(response: any) {
  console.log('=== PARSING DOCUMENT AI RESPONSE ===');
  
  const document = response.document;
  if (!document) {
    console.log('No document found in response');
    return [];
  }

  const pages = document.pages || [];
  const results = [];

  console.log('Processing', pages.length, 'pages from Document AI');

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const pageNumber = pageIndex + 1;
    
    // Extract text blocks with position information
    const textBlocks: TextBlock[] = [];
    let fullPageText = '';
    let totalConfidence = 0;
    let blockCount = 0;

    // Process paragraphs
    if (page.paragraphs) {
      console.log('Processing', page.paragraphs.length, 'paragraphs for page', pageNumber);
      
      for (const paragraph of page.paragraphs) {
        const layout = paragraph.layout;
        if (layout && layout.textAnchor && layout.textAnchor.textSegments) {
          let paragraphText = '';
          
          for (const segment of layout.textAnchor.textSegments) {
            const startIndex = parseInt(segment.startIndex || '0');
            const endIndex = parseInt(segment.endIndex || '0');
            
            if (document.text) {
              paragraphText += document.text.substring(startIndex, endIndex);
            }
          }
          
          if (paragraphText.trim()) {
            fullPageText += paragraphText + '\n';
            
            // Extract bounding box information
            const boundingBox = extractDocumentAIBoundingBox(layout.boundingPoly);
            const confidence = layout.confidence || 0.9;

            textBlocks.push({
              text: paragraphText.trim(),
              boundingBox,
              confidence,
              pageNumber
            });

            totalConfidence += confidence;
            blockCount++;
          }
        }
      }
    }

    // If no paragraphs found, use the full text
    if (textBlocks.length === 0 && document.text) {
      console.log('No paragraphs found, using full document text');
      fullPageText = document.text;
      textBlocks.push({
        text: fullPageText,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        pageNumber
      });
      totalConfidence = 0.9;
      blockCount = 1;
    }

    const averageConfidence = blockCount > 0 ? totalConfidence / blockCount : 0.9;

    console.log('Page', pageNumber, 'processed:', textBlocks.length, 'blocks, confidence:', averageConfidence);

    results.push({
      pageNumber,
      text: fullPageText.trim(),
      textBlocks,
      confidence: averageConfidence
    });
  }

  console.log('Document AI parsing completed:', results.length, 'pages');
  return results;
}

function parseVisionAPIResponse(response: any) {
  console.log('=== PARSING VISION API RESPONSE ===');
  
  const responses = response.responses || [];
  if (responses.length === 0) {
    console.log('No responses from Vision API');
    return [];
  }

  const firstResponse = responses[0];
  if (!firstResponse.fullTextAnnotation) {
    console.log('No text annotation found in response');
    return [{
      pageNumber: 1,
      text: '',
      textBlocks: [],
      confidence: 0
    }];
  }

  const fullTextAnnotation = firstResponse.fullTextAnnotation;
  const pages = fullTextAnnotation.pages || [];
  const results = [];

  console.log('Processing', pages.length, 'pages from Vision API');

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const pageNumber = pageIndex + 1;
    
    // Extract text blocks with position information
    const textBlocks: TextBlock[] = [];
    let fullPageText = '';
    let totalConfidence = 0;
    let blockCount = 0;

    if (page.blocks) {
      console.log('Processing', page.blocks.length, 'blocks for page', pageNumber);
      
      for (const block of page.blocks) {
        if (block.paragraphs) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.words) {
              let paragraphText = '';
              let paragraphConfidence = 0;
              let wordCount = 0;
              
              for (const word of paragraph.words) {
                if (word.symbols) {
                  let wordText = '';
                  for (const symbol of word.symbols) {
                    wordText += symbol.text || '';
                  }
                  paragraphText += wordText + ' ';
                  paragraphConfidence += word.confidence || 0.9;
                  wordCount++;
                }
              }
              
              if (paragraphText.trim()) {
                fullPageText += paragraphText + '\n';
                
                // Extract bounding box information
                const boundingBox = extractVisionBoundingBox(paragraph.boundingBox);
                const confidence = wordCount > 0 ? paragraphConfidence / wordCount : 0.9;

                textBlocks.push({
                  text: paragraphText.trim(),
                  boundingBox,
                  confidence,
                  pageNumber
                });

                totalConfidence += confidence;
                blockCount++;
              }
            }
          }
        }
      }
    }

    // If no blocks found, use the full text
    if (textBlocks.length === 0 && fullTextAnnotation.text) {
      console.log('No blocks found, using full text annotation');
      fullPageText = fullTextAnnotation.text;
      textBlocks.push({
        text: fullPageText,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        pageNumber
      });
      totalConfidence = 0.9;
      blockCount = 1;
    }

    const averageConfidence = blockCount > 0 ? totalConfidence / blockCount : 0.9;

    console.log('Page', pageNumber, 'processed:', textBlocks.length, 'blocks, confidence:', averageConfidence);

    results.push({
      pageNumber,
      text: fullPageText.trim(),
      textBlocks,
      confidence: averageConfidence
    });
  }

  // If no pages found but we have text, create a single page
  if (results.length === 0 && fullTextAnnotation.text) {
    console.log('No pages found, creating single page from full text');
    results.push({
      pageNumber: 1,
      text: fullTextAnnotation.text,
      textBlocks: [{
        text: fullTextAnnotation.text,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        pageNumber: 1
      }],
      confidence: 0.9
    });
  }

  console.log('Vision API parsing completed:', results.length, 'pages');
  return results;
}

function extractDocumentAIBoundingBox(boundingPoly: any) {
  if (!boundingPoly || !boundingPoly.vertices || boundingPoly.vertices.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const vertices = boundingPoly.vertices;
  const xs = vertices.map((v: any) => v.x || 0);
  const ys = vertices.map((v: any) => v.y || 0);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function extractVisionBoundingBox(boundingBox: any) {
  if (!boundingBox || !boundingBox.vertices || boundingBox.vertices.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const vertices = boundingBox.vertices;
  const xs = vertices.map((v: any) => v.x || 0);
  const ys = vertices.map((v: any) => v.y || 0);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}