
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

  // Immediately throw for unsupported types to prevent further processing
  if (mimeType === 'application/pdf' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.error(`Full text extraction for ${mimeType} is not yet implemented. Please use a .txt file or enhance this function.`);
    throw new Error(`Direct text extraction for ${mimeType} is not yet supported. Please use a .txt file for now. Advanced parsing for this file type needs to be added.`);
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');

    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } else {
      // This case should ideally not be reached if PDF/DOCX are handled above.
      // If other types are attempted, this will try UTF-8 decoding.
      console.warn(`Attempting UTF-8 decoding for unsupported MIME type: ${mimeType}. Results may vary.`);
      return buffer.toString('utf-8');
    }
  } catch (error: any) {
    console.error(`Error decoding Base64 content for MIME type "${mimeType}". Base64 data (first 50 chars):`, base64Data.substring(0,50), "Error:", error.message);
    throw new Error(`Failed to decode or process content for MIME type "${mimeType}". This might be due to invalid characters in the document or incorrect encoding. Original error: ${error.message}`);
  }
}


export async function validateOpenRouterApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  if (!apiKey) {
    return { isValid: false, error: "API Key cannot be empty." };
  }
  try {
    // Using a lightweight endpoint to check key validity if /auth/key is not suitable for all key types or scenarios.
    // A more robust check might involve listing models or a similar low-cost operation.
    // For this example, we are using the /generation/limits which often works for key validation.
    // If OpenRouter provides a dedicated key validation endpoint, that should be preferred.
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', { // Reverted to /auth/key as it's specific for validation
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

export async function testOpenRouterModel(apiKey: string, modelName: string): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!apiKey) {
    return { success: false, error: "API Key is missing." };
  }
  if (!modelName) {
    return { success: false, error: "Model name is missing." };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
        'X-Title': 'Policy Compliance Analyzer - Model Test',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: "Hello! Respond with 'OK' if you are working." }],
        max_tokens: 10, // Keep it minimal
      }),
    });

    const responseBody = await response.text(); // Read body once

    if (response.ok) {
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch(e){
         return { success: false, error: `Model test failed: Could not parse JSON response for ${modelName}. Response: ${responseBody}` };
      }
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return { success: true, message: `Model ${modelName} responded.` };
      } else {
        return { success: false, error: `Model test failed: Unexpected response structure from ${modelName}. Response: ${JSON.stringify(data)}` };
      }
    } else {
        if (response.status === 401) {
             return { success: false, error: `Model test failed: Invalid API Key or unauthorized for ${modelName}. (401)` };
        }
         if (response.status === 429) {
             return { success: false, error: `Model test failed: Rate limit exceeded for ${modelName}. (429)` };
        }
        if (response.status === 404) {
             return { success: false, error: `Model test failed: Model ${modelName} not found or not accessible. (404)` };
        }
      return { success: false, error: `Model test failed for ${modelName} (status: ${response.status}). Response: ${responseBody}`.trim() };
    }
  } catch (error: any) {
    console.error(`Model test fetch error for ${modelName}:`, error);
    return { success: false, error: `Failed to test model ${modelName} due to a network or server issue: ${error.message}` };
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
  } catch (error: any)
 {
    console.error("Error generating RCM:", error);
    // Return the specific error message from extractTextFromDataUri or generateRiskControlMatrix
    return { error: error.message || "An unknown error occurred while generating the RCM." };
  }
}

    