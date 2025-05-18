
"use server";

import { extractClausesAndMapToStandards, type ExtractClausesAndMapToStandardsInput, type ExtractClausesAndMapToStandardsOutput } from "@/ai/flows/extract-clauses-and-map-to-standards";
// generateRiskControlMatrix and RcmEntry are no longer directly used by generateRcmAction but might be kept for other purposes or tests.
// For now, let's keep them commented or remove if truly unused later.
// import { generateRiskControlMatrix, type GenerateRiskControlMatrixInput, type GenerateRiskControlMatrixOutput, type RcmEntry } from "@/ai/flows/generate-risk-control-matrix";

// pdf-parse is dynamically imported below

const MAX_CHUNK_CHARS = 6000; // Max characters for a paragraph before attempting sentence splitting (No longer used by generateRcmAction)

// Helper function to split text into manageable chunks (clauses/paragraphs) - No longer used by generateRcmAction
function splitTextIntoChunks(text: string): string[] {
  if (!text || text.trim() === "") {
    return [];
  }

  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  // Removed further sentence splitting logic based on MAX_CHUNK_CHARS for this version
  return paragraphs.filter(chunk => chunk.trim().length > 0);
}


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

  const meta = parts[0];
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
  
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.error(`Full text extraction for ${mimeType} is not yet implemented. Please use a .txt or .pdf file, or enhance this function.`);
    throw new Error(`Direct text extraction for ${mimeType} is not yet supported. Please use a .txt or .pdf file for now. Advanced parsing for this file type needs to be added.`);
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');

    if (mimeType === 'application/pdf') {
      if (buffer.length === 0) {
        console.error("PDF content resulted in an empty buffer. This could be due to an empty PDF or malformed base64 data in the Data URI.");
        throw new Error("The PDF file appears to be empty or its data is corrupted, as no content could be processed.");
      }
      try {
        const pdf = (await import('pdf-parse')).default;
        const data = await pdf(buffer);
        if (!data || typeof data.text !== 'string') {
          console.error("pdf-parse did not return the expected text structure. Data received:", data);
          throw new Error('PDF parsing did not return the expected text structure (e.g., missing text field or not a string).');
        }
        return data.text;
      } catch (pdfError: any) {
        console.error(`Error parsing PDF content with pdf-parse. PDF-Parse error message:`, pdfError.message, pdfError.stack);
        const originalErrorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
        throw new Error(`Failed to parse PDF content. This might be due to a corrupted, password-protected, or image-only PDF. Original error from pdf-parse: ${originalErrorMessage}`);
      }
    } else if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } else {
       throw new Error(`Unsupported file type: ${mimeType}. Please use .txt or .pdf files.`);
    }
  } catch (error: any) {
    console.error(`Error in extractTextFromDataUri for MIME type "${mimeType}". Error:`, error.message, error.stack);
    if (error.message.startsWith("Failed to parse PDF content") || 
        error.message.startsWith("Direct text extraction for") ||
        error.message.startsWith("The PDF file appears to be empty") ||
        error.message.startsWith("Unsupported file type:") ||
        error.message.startsWith("PDF parsing did not return the expected text structure")) {
        throw error; 
    }
    throw new Error(`Failed to process document content for MIME type "${mimeType}". This might be due to invalid characters or encoding. Original error: ${error instanceof Error ? error.message : String(error)}`);
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

    const responseBodyText = await response.text(); 

    if (response.ok) {
      return { isValid: true };
    } else {
      let errorMessage = `API Key validation failed (Status: ${response.status}).`;
      try {
        const errorData = JSON.parse(responseBodyText);
        if (errorData.error && errorData.error.message) {
          errorMessage += ` Message: ${errorData.error.message}`;
        } else if (errorData.message) { 
           errorMessage += ` Message: ${errorData.message}`;
        } else {
          errorMessage += ` Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
        }
      } catch (e) {
        errorMessage += ` Raw Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
      }
      return { isValid: false, error: errorMessage.trim() };
    }
  } catch (error: any) {
    console.error("API Key validation fetch error:", error.name, error.message, error.stack);
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
        max_tokens: 10, 
      }),
    });

    const responseBodyText = await response.text(); 

    if (response.ok) {
      let data;
      try {
        data = JSON.parse(responseBodyText);
      } catch(e){
         const truncatedBody = responseBodyText.length > 300 ? responseBodyText.substring(0, 300) + "..." : responseBodyText;
         return { success: false, error: `Model test failed: Could not parse JSON response for ${modelName}. Response: ${truncatedBody}` };
      }
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return { success: true, message: `Model ${modelName} responded.` };
      } else {
        const truncatedData = JSON.stringify(data).length > 300 ? JSON.stringify(data).substring(0, 300) + "..." : JSON.stringify(data);
        return { success: false, error: `Model test failed: Unexpected response structure from ${modelName}. Response: ${truncatedData}` };
      }
    } else {
        let errorMessage = `Model test failed for ${modelName} (Status: ${response.status}).`;
        try {
            const errorData = JSON.parse(responseBodyText);
            if (errorData.error && errorData.error.message) {
              errorMessage += ` Message: ${errorData.error.message}`;
            } else if (errorData.message) { 
               errorMessage += ` Message: ${errorData.message}`;
            } else {
               errorMessage += ` Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
            }
        } catch (e) {
            errorMessage += ` Raw Response: ${responseBodyText.substring(0, 300)}${responseBodyText.length > 300 ? "..." : ""}`;
        }
        
        if (response.status === 401) { 
             return { success: false, error: `Model test failed: Invalid API Key or unauthorized for ${modelName}. (401). Details: ${errorMessage}` };
        }
        if (response.status === 429) { 
             return { success: false, error: `Model test failed: Rate limit exceeded for ${modelName}. (429). Details: ${errorMessage}` };
        }
        if (response.status === 404) { 
             return { success: false, error: `Model test failed: Model ${modelName} not found or not accessible. (404). Details: ${errorMessage}` };
        }
        return { success: false, error: errorMessage.trim() };
    }
  } catch (error: any) {
    console.error(`Model test fetch error for ${modelName}:`, error.name, error.message, error.stack);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to test model ${modelName} due to a network or server issue: ${message}` };
  }
}


export async function generateRcmAction(
  params: { documentDataUri: string; openRouterApiKey: string; modelName: string; }
): Promise<{ data?: ExtractClausesAndMapToStandardsOutput; error?: string }> { // Return type changed to ExtractClausesAndMapToStandardsOutput
  const RCM_ERROR_PREFIX = "RCM Generation Failed: ";

  if (!params.openRouterApiKey) {
    return { error: `${RCM_ERROR_PREFIX}OpenRouter API Key is missing.` };
  }
  if (!params.documentDataUri) {
    return { error: `${RCM_ERROR_PREFIX}Document data is missing.` };
  }
  if (!params.modelName) {
    return { error: `${RCM_ERROR_PREFIX}AI Model name is missing.` };
  }

  try {
    const fullDocumentText = await extractTextFromDataUri(params.documentDataUri);

    if (!fullDocumentText || fullDocumentText.trim() === "") {
        return { error: `${RCM_ERROR_PREFIX}Extracted document text is empty. Cannot proceed with RCM generation. The document might be empty, not parseable, or contain no extractable text.` };
    }
    
    console.log(`[generateRcmAction] Processing full document text with model ${params.modelName}...`);

    const inputForFullDocument: ExtractClausesAndMapToStandardsInput = {
        documentText: fullDocumentText,
        apiKey: params.openRouterApiKey,
        modelName: params.modelName,
    };
    
    const result = await extractClausesAndMapToStandards(inputForFullDocument);

    if (!result || !result.rcmEntries) { // Check if result or rcmEntries is null/undefined
        console.error("[generateRcmAction] AI flow 'extractClausesAndMapToStandards' returned null, undefined, or a result without 'rcmEntries'. Full document text length:", fullDocumentText.length, "Model:", params.modelName);
        throw new Error(`AI flow did not return the expected RCM data structure for the full document. The AI might have failed to process the document or returned an empty/malformed response. Check AI provider logs for model ${params.modelName}.`);
    }

    // If rcmEntries is an empty array, it's a valid response (e.g., AI found no relevant clauses)
    console.log(`[generateRcmAction] Successfully processed full document. ${result.rcmEntries.length} RCM entries generated.`);
    return { data: result };

  } catch (e: unknown) {
    let errorMessage = `${RCM_ERROR_PREFIX}An unexpected error occurred.`;
    if (e instanceof Error) {
      console.error("[generateRcmAction] Caught Error Name:", e.name);
      console.error("[generateRcmAction] Caught Error Message:", e.message);
      console.error("[generateRcmAction] Caught Error Stack:", e.stack);
      // If the error message already has the prefix (from clause processing error), don't add it again.
      errorMessage = e.message.startsWith(RCM_ERROR_PREFIX) ? e.message : `${RCM_ERROR_PREFIX}${e.message}`;
    } else if (typeof e === 'string') {
      console.error("[generateRcmAction] Caught string error:", e);
      errorMessage = `${RCM_ERROR_PREFIX}${e}`;
    } else {
      console.error("[generateRcmAction] Caught unknown error type. Value:", e);
      try {
        const stringifiedError = JSON.stringify(e);
        const truncatedError = stringifiedError.length > 300 ? stringifiedError.substring(0, 300) + "..." : stringifiedError;
        errorMessage = `${RCM_ERROR_PREFIX}An unexpected error occurred. Details: ${truncatedError}`;
      } catch (stringifyError) {
        console.error("[generateRcmAction] Failed to stringify unknown error:", stringifyError);
        errorMessage = `${RCM_ERROR_PREFIX}An unexpected and unstringifiable error occurred.`;
      }
    }
    return { error: errorMessage };
  }
}


