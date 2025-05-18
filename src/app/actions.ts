
"use server";

import { generateRiskControlMatrix, type GenerateRiskControlMatrixInput, type GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";

export async function validateOpenRouterApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  if (!apiKey) {
    return { isValid: false, error: "API Key cannot be empty." };
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { isValid: true };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { isValid: false, error: `Invalid API Key (status: ${response.status}). ${errorData.error?.message || ''}`.trim() };
    }
  } catch (error) {
    console.error("API Key validation error:", error);
    return { isValid: false, error: "Failed to validate API Key due to a network or server error." };
  }
}

export async function generateRcmAction(
  input: GenerateRiskControlMatrixInput,
  // openRouterApiKey: string // Placeholder for future use if AI flows are adapted
): Promise<{ data?: GenerateRiskControlMatrixOutput; error?: string }> {
  try {
    // Note: The provided genkit flow `generateRiskControlMatrix` currently uses Google AI,
    // not the OpenRouter API key. This `openRouterApiKey` parameter is kept for conceptual alignment
    // with the prompt, assuming the AI flows might be updated later to use it.
    const result = await generateRiskControlMatrix(input);
    return { data: result };
  } catch (error: any) {
    console.error("Error generating RCM:", error);
    return { error: error.message || "An unknown error occurred while generating the RCM." };
  }
}
