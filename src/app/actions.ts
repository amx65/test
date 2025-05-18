
"use server";

import { generateRiskControlMatrix, type GenerateRiskControlMatrixInput, type GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";

// Helper function to extract text from Data URI
async function extractTextFromDataUri(dataUri: string): Promise<string> {
  if (!dataUri || typeof dataUri !== 'string') {
    throw new Error('Invalid Data URI: input is null, undefined, or not a string.');
  }

  const parts = dataUri.split(',');
  if (parts.length < 2) {
    console.error("Invalid Data URI format. URI (first 100 chars):", dataUri.substring(0,100));
    throw new Error('Invalid Data URI format: does not contain a comma to separate metadata and data.');
  }

  const meta = parts[0]; // e.g., "data:text/plain;base64"
  const base64Data = parts[1];

  const mimeTypeMatch = meta.match(/^data:(.+);base64$/);
  if (!mimeTypeMatch || !mimeTypeMatch[1]) {
    console.error("Could not determine MIME type or base64 encoding from Data URI. Meta part:", meta);
    throw new Error('Could not determine MIME type or base64 encoding from Data URI. Expected format "data:<mimetype>;base64".');
  }
  const mimeType = mimeTypeMatch[1];

  if (base64Data === undefined || base64Data === null) {
      throw new Error('Invalid Data URI: Base64 data part is missing.');
  }

  if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.error(`Full text extraction for ${mimeType} is not yet implemented. Please use a .txt file or enhance this function.`);
    // This error will be caught by generateRcmAction and propagated to the UI.
    throw new Error(`Direct text extraction for ${mimeType} is not yet supported. Please use a .txt file for now. Advanced parsing for this file type needs to be added.`);
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');

    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } else {
      console.warn(`Attempting UTF-8 decoding for unsupported MIME type: ${mimeType}. Results may vary.`);
      return buffer.toString('utf-8'); 
    }
  } catch (error: any) {
    console.error(`Error decoding Base64 content for MIME type "${mimeType}". Base64 data (first 50 chars):`, base64Data.substring(0,50), "Error:", error.message);
    // This error will be caught by generateRcmAction and propagated to the UI.
    throw new Error(`Failed to decode or process content for MIME type "${mimeType}". This might be due to invalid characters in the document or incorrect encoding. Original error: ${error.message}`);
  }
}


export async function validateOpenRouterApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  if (!apiKey) {
    return { isValid: false, error: "API Key cannot be empty." };
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002', 
        'X-Title': 'Policy Compliance Analyzer',
      },
    });

    if (response.ok) {
      return { isValid: true };
    } else {
      const errorText = await response.text();
      if (response.status === 401) {
         try {
            const errorData = JSON.parse(errorText);
            return { isValid: false, error: `Invalid API Key (Unauthorized). ${errorData.error?.message || 'Please check your OpenRouter API key.'}`.trim() };
        } catch (e) {
            return { isValid: false, error: `Invalid API Key (Unauthorized). Server response: ${errorText}`.trim() };
        }
      }
      return { isValid: false, error: `API Key validation failed (status: ${response.status}). Response: ${errorText}`.trim() };
    }
  } catch (error: any) {
    console.error("API Key validation fetch error:", error);
    return { isValid: false, error: `Failed to validate API Key due to a network or server issue: ${error.message}` };
  }
}

export async function generateRcmAction(
  params: { documentDataUri: string; openRouterApiKey: string; modelName: string; }
): Promise<{ data?: GenerateRiskControlMatrixOutput; error?: string }> {
  if (!params.openRouterApiKey) {
    return { error: "OpenRouter API Key is missing." };
  }
  if (!params.documentDataUri) {
    return { error: "Document data is missing." };
  }
  if (!params.modelName) {
    return { error: "AI Model name is missing." };
  }

  try {
    const documentText = await extractTextFromDataUri(params.documentDataUri);
    
    const input: GenerateRiskControlMatrixInput = {
      documentText: documentText,
      apiKey: params.openRouterApiKey,
      modelName: params.modelName,
    };
    
    const result = await generateRiskControlMatrix(input);
    return { data: result };
  } catch (error: any) {
    console.error("Error generating RCM:", error);
    // Return the specific error message from extractTextFromDataUri or generateRiskControlMatrix
    return { error: error.message || "An unknown error occurred while generating the RCM." };
  }
}
