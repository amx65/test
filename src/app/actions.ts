
"use server";

import { generateRiskControlMatrix, type GenerateRiskControlMatrixInput, type GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";
// Note: ExtractClausesAndMapToStandardsOutput type might not be directly used here if generateRcmAction only uses generateRiskControlMatrix
// However, if there was a combined flow or another action using it, its type would be imported similarly.
// import type { ExtractClausesAndMapToStandardsOutput } from "@/ai/flows/extract-clauses-and-map-to-standards";


// Helper function to extract text from Data URI
// IMPORTANT: This is a basic implementation. PDF/DOCX parsing requires dedicated libraries.
async function extractTextFromDataUri(dataUri: string): Promise<string> {
  const parts = dataUri.split(',');
  if (parts.length < 2) throw new Error('Invalid Data URI format.');
  
  const meta = parts[0]; // e.g., "data:text/plain;base64"
  const base64Data = parts[1];

  const mimeTypeMatch = meta.match(/data:(.*);base64/);
  if (!mimeTypeMatch || !mimeTypeMatch[1]) {
    throw new Error('Could not determine MIME type from Data URI.');
  }
  const mimeType = mimeTypeMatch[1];

  try {
    const buffer = Buffer.from(base64Data, 'base64');

    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } else if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // TODO: Implement proper PDF and DOCX text extraction using libraries like 'pdf-parse' for PDFs
      // and 'mammoth' for DOCX. This is a complex task not covered by this basic implementation.
      // For now, we throw an error to inform the user about this limitation.
      console.error(`Full text extraction for ${mimeType} is not yet implemented. Please use a .txt file or enhance this function.`);
      throw new Error(`Direct text extraction for ${mimeType} is not yet supported. Please use a .txt file for now. Advanced parsing for this file type needs to be added.`);
    } else {
      // For other binary types or unknown text types, attempt a UTF-8 decode, but it may not be meaningful.
      console.warn(`Attempting UTF-8 decoding for unsupported MIME type: ${mimeType}. Results may vary.`);
      return buffer.toString('utf-8'); // Fallback, might produce gibberish for binary files
    }
  } catch (error) {
    console.error("Error processing Data URI:", error);
    throw new Error("Failed to process document content from Data URI.");
  }
}


export async function validateOpenRouterApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  if (!apiKey) {
    return { isValid: false, error: "API Key cannot be empty." };
  }
  try {
    // Using 'https://openrouter.ai/api/v1/auth/key' as a lightweight check,
    // as per OpenRouter documentation for key validation.
    // The /models endpoint can be large and slow.
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002', 
        'X-Title': 'Policy Compliance Analyzer',
      },
    });

    if (response.ok) {
      // A 200 OK from /auth/key implies the key is valid and has some credit/rate limit.
      return { isValid: true };
    } else {
      const errorText = await response.text();
      // OpenRouter returns 401 for invalid keys for /auth/key endpoint.
      if (response.status === 401) {
         try {
            const errorData = JSON.parse(errorText);
            return { isValid: false, error: `Invalid API Key (Unauthorized). ${errorData.error?.message || 'Please check your OpenRouter API key.'}`.trim() };
        } catch (e) {
            return { isValid: false, error: `Invalid API Key (Unauthorized). Server response: ${errorText}`.trim() };
        }
      }
      // For other errors from /auth/key
      return { isValid: false, error: `API Key validation failed (status: ${response.status}). Response: ${errorText}`.trim() };
    }
  } catch (error: any) {
    console.error("API Key validation fetch error:", error);
    return { isValid: false, error: `Failed to validate API Key due to a network or server issue: ${error.message}` };
  }
}

export async function generateRcmAction(
  params: { documentDataUri: string; openRouterApiKey: string; }
): Promise<{ data?: GenerateRiskControlMatrixOutput; error?: string }> {
  if (!params.openRouterApiKey) {
    return { error: "OpenRouter API Key is missing." };
  }
  if (!params.documentDataUri) {
    return { error: "Document data is missing." };
  }

  try {
    const documentText = await extractTextFromDataUri(params.documentDataUri);
    
    const input: GenerateRiskControlMatrixInput = {
      documentText: documentText,
      apiKey: params.openRouterApiKey,
    };
    
    // Assuming generateRiskControlMatrix is the primary flow to call.
    // If extractClausesAndMapToStandards was meant to be called first, or in conjunction,
    // this logic would need to be adjusted.
    const result = await generateRiskControlMatrix(input);
    return { data: result };
  } catch (error: any) {
    console.error("Error generating RCM:", error);
    return { error: error.message || "An unknown error occurred while generating the RCM." };
  }
}
