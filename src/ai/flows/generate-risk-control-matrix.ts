
// src/ai/flows/generate-risk-control-matrix.ts
'use server';

/**
 * @fileOverview Generates a Risk Control Matrix (RCM) for a single policy clause using OpenRouter.
 *
 * - generateRiskControlMatrix - A function that orchestrates RCM generation for a clause.
 * - GenerateRiskControlMatrixInput - The input type for the generateRiskControlMatrix function.
 * - GenerateRiskControlMatrixOutput - The return type for the generateRiskControlMatrix function.
 * - RcmEntry - The type for a single RCM entry.
 */

import {z, ZodError} from 'genkit';

// Define input schema for the new structure, now taking a single clause and its ID
const GenerateRiskControlMatrixInputSchema = z.object({
  clauseText: z
    .string()
    .describe('The text content of the policy clause to be analyzed.'),
  clauseId: z
    .string()
    .describe('A unique identifier for this specific policy clause (e.g., C001).'),
  apiKey: z.string().describe('The OpenRouter API key.'),
  modelName: z.string().describe('The OpenRouter model name to use (e.g., deepseek/deepseek-chat-v3-0324:free).'),
});
export type GenerateRiskControlMatrixInput = z.infer<typeof GenerateRiskControlMatrixInputSchema>;

// RcmEntrySchema remains internal but crucial for validation
const RcmEntrySchema = z.object({
  policyClauseId: z.string().describe('Unique identifier for the policy clause (MUST match the input clauseId).'),
  policyClauseText: z.string().describe('Verbatim text of the policy clause (MUST match the input clauseText).'),
  controlFramework: z.string().describe('The compliance framework to which the control maps (e.g., COSO, COBIT, ISO 27001, ISO 31000).'),
  controlId: z.string().describe('Identifier for the specific control within the chosen framework.'),
  controlType: z.enum(['Preventive', 'Detective', 'Corrective', 'Directive']).describe('Classification of the control type.'),
  mappingRationale: z.string().describe('One-sentence justification for the control mapping, citing the standard.'),
  controlDescription: z.string().describe('Actionable objective of the control.'),
  riskRating: z.enum(['High', 'Medium', 'Low']).describe('Assigned risk rating for the clause.'),
  identifiedRisk: z.string().describe('Description of the risk (cause -> nature -> impact).'),
  auditTest: z.string().describe('Proposed audit test to validate control effectiveness (data source, sampling, expected outcome).'),
  recommendedAction: z.string().describe('Recommended action to address the identified risk or control gap.'),
});

const GenerateRiskControlMatrixOutputSchema = z.object({
  rcmEntries: z.array(RcmEntrySchema).describe('Array of Risk Control Matrix entries, typically one per clause input.'),
});
export type GenerateRiskControlMatrixOutput = z.infer<typeof GenerateRiskControlMatrixOutputSchema>;

export type RcmEntry = z.infer<typeof RcmEntrySchema>;

export async function generateRiskControlMatrix(
  input: GenerateRiskControlMatrixInput
): Promise<GenerateRiskControlMatrixOutput> {
  const validatedInput = GenerateRiskControlMatrixInputSchema.parse(input);
  const { clauseText, clauseId, apiKey, modelName } = validatedInput;

  const promptText = `You are an expert auditor tasked with generating a Risk Control Matrix (RCM) entry for a specific policy clause.

Analyze the provided policy clause text, map it to a relevant compliance standard (COSO, COBIT, ISO 27001, ISO 31000), 
and generate descriptions of a control, risk, and audit test for THIS CLAUSE ONLY.

The policy clause text is identified as "${clauseId}" and its content is as follows:
---
${clauseText}
---

For THIS clause, create ONE RCM entry with the following fields:

- policyClauseId: MUST be exactly "${clauseId}".
- policyClauseText: MUST be the verbatim text of the provided policy clause: "${clauseText}".
- controlFramework: The compliance framework (e.g., COSO, COBIT, ISO 27001, ISO 31000).
- controlId: The identifier for the specific control within the chosen framework.
- controlType: Classify the control type as Preventive, Detective, Corrective, or Directive.
- mappingRationale: A one-sentence justification for the control mapping, citing the standard.
- controlDescription: An actionable objective of the control.
- riskRating: Assign a risk rating of High, Medium, or Low.
- identifiedRisk: Describe the risk (cause -> nature -> impact).
- auditTest: Propose an audit test (data source, sampling, expected outcome).
- recommendedAction: Recommend an action to address the risk or control gap.

If the clause text is very short, unclear, or not suitable for RCM generation, you MUST return an empty "rcmEntries" array like this: { "rcmEntries": [] }. Do not attempt to generate an entry from unsuitable text.

IMPORTANT: Return ONLY the RCM data in JSON format. The entire response must be a single JSON object matching this structure:
{ "rcmEntries": [ /* A single RCM entry as described above, or an empty array if the clause is not suitable */ ] }
Do NOT include any explanatory text, markdown formatting like \`\`\`json, or any other content before or after the JSON object. The response must be solely the JSON object itself.
Ensure the output for "policyClauseId" is "${clauseId}" and "policyClauseText" is exactly the clause text provided above.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
        'X-Title': 'Policy Compliance Analyzer - Clause Processor',
      },
      body: JSON.stringify({
        model: modelName, 
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: "json_object" }, 
      }),
    });

    if (!response.ok) {
      const errorBodyText = await response.text();
      let detailedError = `OpenRouter API request failed for clause "${clauseId}" with model ${modelName} (Status ${response.status})`;
      try {
        const parsedError = JSON.parse(errorBodyText);
        if (parsedError && parsedError.error && parsedError.error.message) {
          detailedError += `: ${parsedError.error.message}`;
        } else if (parsedError && parsedError.message) {
          detailedError += `: ${parsedError.message}`;
        } else {
          detailedError += `. Response: ${errorBodyText.substring(0, 500)}${errorBodyText.length > 500 ? "..." : ""}`;
        }
      } catch (e) {
        detailedError += `. Raw Response: ${errorBodyText.substring(0, 500)}${errorBodyText.length > 500 ? "..." : ""}`;
      }
      console.error(`OpenRouter API Error for clause "${clauseId}", Model ${modelName}:`, response.status, errorBodyText);
      throw new Error(detailedError);
    }

    const result = await response.json();
    
    if (!result.choices || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
        console.error(`Invalid response structure from OpenRouter for clause "${clauseId}", Model ${modelName}:`, result);
        throw new Error(`Received an invalid response structure from OpenRouter for clause "${clauseId}" with model ${modelName}. The AI did not provide any content. Check API logs.`);
    }
    
    const assistantResponseText = result.choices[0].message.content;
    if (typeof assistantResponseText !== 'string' || assistantResponseText.trim() === "") {
        console.error(`Empty or non-string content from OpenRouter assistant for clause "${clauseId}", Model ${modelName}:`, assistantResponseText);
        throw new Error(`Received empty or non-string content from the AI model ${modelName} for clause "${clauseId}".`);
    }

    let parsedJson;
    try {
        const cleanedResponseText = assistantResponseText.replace(/^```json\s*|```$/g, '').trim();
        if (cleanedResponseText === "") {
            throw new Error(`AI returned an empty string after cleaning markdown for clause "${clauseId}", Model ${modelName}.`);
        }
        parsedJson = JSON.parse(cleanedResponseText);
    } catch (e: any) {
        console.error(`Failed to parse JSON response from OpenRouter for clause "${clauseId}", Model ${modelName}:`, assistantResponseText, e);
        const snippet = assistantResponseText.substring(0, 200) + (assistantResponseText.length > 200 ? "..." : "");
        throw new Error(`Failed to parse the AI's JSON response for clause "${clauseId}" with model ${modelName}. The AI might have returned malformed JSON. Start of response: "${snippet}". Original parsing error: ${e.message}`);
    }
    
    const validatedOutput = GenerateRiskControlMatrixOutputSchema.parse(parsedJson);
    
    // Additional validation: ensure the AI respected the clauseId and clauseText instructions
    if (validatedOutput.rcmEntries.length > 0) {
        const entry = validatedOutput.rcmEntries[0];
        if (entry.policyClauseId !== clauseId) {
            console.warn(`AI did not use the provided policyClauseId. Expected: "${clauseId}", Got: "${entry.policyClauseId}" for model ${modelName}`);
            // Optionally, force the ID: entry.policyClauseId = clauseId; 
            // For now, we'll allow it but log a warning. Critical apps might throw error or correct it.
        }
        // Text comparison can be tricky due to minor AI rephrasing or whitespace. Be cautious.
        // if (entry.policyClauseText !== clauseText) {
        //   console.warn(`AI modified policyClauseText. Expected: "${clauseText}", Got: "${entry.policyClauseText}" for model ${modelName}`);
        // }
    }
    
    return validatedOutput;

  } catch (error: any) {
    let finalErrorMessage: string;

    if (error.message?.includes("OpenRouter API request failed") || 
        error.message?.includes("Failed to parse the AI's JSON response") || 
        error.message?.includes("Received an invalid response structure") ||
        error.message?.includes("AI returned an empty string after cleaning markdown") ||
        error.message?.includes("Received empty or non-string content")) {
        finalErrorMessage = error.message;
    } else if (error instanceof ZodError) {
      const issues = error.errors.map(err => `(${err.path.join('.')}: ${err.message})`).join(', ');
      finalErrorMessage = `AI response validation failed for clause "${clauseId}" with model ${modelName}. Issues: ${issues}`;
    } else if (error instanceof Error) {
      finalErrorMessage = `Error during RCM generation for clause "${clauseId}" with model ${modelName}: ${error.message}`;
    } else {
      finalErrorMessage = `An unknown error occurred during RCM generation for clause "${clauseId}" with model ${modelName}.`;
    }
    console.error(`Error in generateRiskControlMatrix flow for clause "${clauseId}", Model ${modelName}:`, error.name, error.message, error.stack);
    throw new Error(finalErrorMessage);
  }
}
