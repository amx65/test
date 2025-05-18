
"use server";

import { generateRiskControlMatrix, type GenerateRiskControlMatrixInput, type GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";
import pdf from 'pdf-parse';

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

  if (base64Data === undefined || base64Data === null) { // Check if base64Data itself is missing
      throw new Error('Invalid Data URI: Base64 data part is missing.');
  }
  
  // Immediately throw for .docx as it's not supported yet
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.error(`Full text extraction for ${mimeType} is not yet implemented. Please use a .txt or .pdf file, or enhance this function.`);
    throw new Error(`Direct text extraction for ${mimeType} is not yet supported. Please use a .txt or .pdf file for now. Advanced parsing for this file type needs to be added.`);
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');

    // Check for empty buffer, which might cause issues with pdf-parse
    if (mimeType === 'application/pdf' && buffer.length === 0) {
      console.error("PDF content resulted in an empty buffer. This could be due to an empty PDF or malformed base64 data in the Data URI.");
      throw new Error("The PDF file appears to be empty or its data is corrupted, as no content could be processed.");
    }

    if (mimeType === 'application/pdf') {
      try {
        const data = await pdf(buffer);
        return data.text;
      } catch (pdfError: any) {
        console.error(`Error parsing PDF content with pdf-parse. PDF-Parse error message:`, pdfError.message);
        const originalErrorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
        // If the error is the specific ENOENT, it's likely an internal pdf-parse issue with certain inputs.
        // The pre-check for empty buffer might prevent some of these.
        throw new Error(`Failed to parse PDF content. This might be due to a corrupted, password-protected, or image-only PDF. Original error from pdf-parse: ${originalErrorMessage}`);
      }
    } else if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } else {
      // For any other unrecognized MIME types that weren't explicitly blocked
      console.warn(`Attempting UTF-8 decoding for unsupported MIME type: ${mimeType}. Results may vary, and this type is not officially supported.`);
      // To prevent unexpected errors, explicitly state it's unsupported rather than trying to decode
       throw new Error(`Unsupported file type: ${mimeType}. Please use .txt or .pdf files.`);
    }
  } catch (error: any) {
    console.error(`Error in extractTextFromDataUri for MIME type "${mimeType}". Error:`, error.message);
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    // Ensure specific errors from handlers above are re-thrown cleanly.
    if (error.message.startsWith("Failed to parse PDF content") || 
        error.message.startsWith("Direct text extraction for") ||
        error.message.startsWith("The PDF file appears to be empty") ||
        error.message.startsWith("Unsupported file type:")) {
        throw error; 
    }
    // Fallback for other errors like Buffer.from issues
    throw new Error(`Failed to process document content for MIME type "${mimeType}". This might be due to invalid characters or encoding. Original error: ${originalErrorMessage}`);
  }
}


export async function validateOpenRouterApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  if (!apiKey) {
    return { isValid: false, error: "API Key cannot be empty." };
  }
  try {
    // Using /auth/key endpoint is more appropriate for key validation
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002', // Added from your previous PRD
        'X-Title': 'Policy Compliance Analyzer', // Added from your previous PRD
      },
    });

    const responseBodyText = await response.text(); // Read body once

    if (response.ok) {
      // Key is valid if status is 200 OK
      // Optionally, check responseBodyText if it's supposed to contain specific data for valid keys
      return { isValid: true };
    } else {
      // Attempt to parse error from OpenRouter's response
      let errorMessage = `API Key validation failed (Status: ${response.status}).`;
      try {
        const errorData = JSON.parse(responseBodyText);
        if (errorData.error && errorData.error.message) {
          errorMessage += ` Message: ${errorData.error.message}`;
        } else if (errorData.message) { // Some APIs might return error directly in message
           errorMessage += ` Message: ${errorData.message}`;
        } else {
          // Fallback if no specific error message structure is found
          errorMessage += ` Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
        }
      } catch (e) {
        // If response body is not JSON or another parsing error
        errorMessage += ` Raw Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
      }
      return { isValid: false, error: errorMessage.trim() };
    }
  } catch (error: any) {
    console.error("API Key validation fetch error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { isValid: false, error: `Failed to validate API Key due to a network or server issue: ${message}` };
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
        max_tokens: 10, // Keep it small for a quick test
      }),
    });

    const responseBodyText = await response.text(); // Read body once for error handling or success parsing

    if (response.ok) {
      let data;
      try {
        data = JSON.parse(responseBodyText);
      } catch(e){
         // If parsing fails, it's an issue.
         const truncatedBody = responseBodyText.length > 300 ? responseBodyText.substring(0, 300) + "..." : responseBodyText;
         return { success: false, error: `Model test failed: Could not parse JSON response for ${modelName}. Response: ${truncatedBody}` };
      }
      
      // Check if the response structure is as expected for a successful test
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        // Optionally check data.choices[0].message.content for "OK"
        return { success: true, message: `Model ${modelName} responded.` };
      } else {
        // Successful HTTP status but unexpected content
        const truncatedData = JSON.stringify(data).length > 300 ? JSON.stringify(data).substring(0, 300) + "..." : JSON.stringify(data);
        return { success: false, error: `Model test failed: Unexpected response structure from ${modelName}. Response: ${truncatedData}` };
      }
    } else {
        // Handle HTTP errors (4xx, 5xx)
        let errorMessage = `Model test failed for ${modelName} (Status: ${response.status}).`;
        try {
            const errorData = JSON.parse(responseBodyText);
            if (errorData.error && errorData.error.message) {
              errorMessage += ` Message: ${errorData.error.message}`;
            } else if (errorData.message) {
               errorMessage += ` Message: ${errorData.message}`;
            } else {
               // Fallback if no specific error message structure
               errorMessage += ` Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
            }
        } catch (e) {
            // If response body is not JSON
            errorMessage += ` Raw Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
        }
        
        // Specific handling for common HTTP errors
        if (response.status === 401) { // Unauthorized
             return { success: false, error: `Model test failed: Invalid API Key or unauthorized for ${modelName}. (401). Details: ${errorMessage}` };
        }
        if (response.status === 429) { // Rate limit
             return { success: false, error: `Model test failed: Rate limit exceeded for ${modelName}. (429). Details: ${errorMessage}` };
        }
        if (response.status === 404) { // Not found
             return { success: false, error: `Model test failed: Model ${modelName} not found or not accessible. (404). Details: ${errorMessage}` };
        }
        // Generic error for other HTTP issues
        return { success: false, error: errorMessage.trim() };
    }
  } catch (error: any) {
    console.error(`Model test fetch error for ${modelName}:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to test model ${modelName} due to a network or server issue: ${message}` };
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

    // Additional check: if documentText is empty after extraction, inform the user.
    if (!documentText || documentText.trim() === "") {
        return { error: "Extracted document text is empty. Cannot proceed with RCM generation. The document might be empty or not parseable." };
    }

    const input: GenerateRiskControlMatrixInput = {
      documentText: documentText,
      apiKey: params.openRouterApiKey,
      modelName: params.modelName,
    };

    const result = await generateRiskControlMatrix(input);
    return { data: result };
  } catch (error: any) {
    console.error("Error in generateRcmAction:", error);
    // Ensure a clear, user-friendly error message is constructed.
    let errorMessage = "An unknown error occurred while generating the RCM.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (_) {
        // fallback if stringifying error itself fails
        errorMessage = String(error);
      }
    }
    // Avoid overly generic messages if a more specific one was thrown
    return { error: `RCM Generation Failed: ${errorMessage}` };
  }
}

    