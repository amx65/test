
// src/ai/flows/generate-risk-control-matrix.ts
'use server';

/**
 * @fileOverview Generates a Risk Control Matrix (RCM) from policy document text using OpenRouter.
 *
 * - generateRiskControlMatrix - A function that orchestrates the RCM generation process.
 * - GenerateRiskControlMatrixInput - The input type for the generateRiskControlMatrix function.
 * - GenerateRiskControlMatrixOutput - The return type for the generateRiskControlMatrix function.
 */

import {z, ZodError} from 'genkit';

// Define input schema for the new structure
const GenerateRiskControlMatrixInputSchema = z.object({
  documentText: z
    .string()
    .describe('The full text content of the policy document.'),
  apiKey: z.string().describe('The OpenRouter API key.'),
  modelName: z.string().describe('The OpenRouter model name to use (e.g., deepseek/deepseek-chat-v3-0324:free).'),
});
export type GenerateRiskControlMatrixInput = z.infer<typeof GenerateRiskControlMatrixInputSchema>;

// RcmEntrySchema remains internal
const RcmEntrySchema = z.object({
  policyClauseId: z.string().describe('Unique identifier for the policy clause (e.g., C001).'),
  policyClauseText: z.string().describe('Verbatim text of the extracted policy clause.'),
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

// OutputSchema is no longer exported directly
const GenerateRiskControlMatrixOutputSchema = z.object({
  rcmEntries: z.array(RcmEntrySchema).describe('Array of Risk Control Matrix entries.'),
});
export type GenerateRiskControlMatrixOutput = z.infer<typeof GenerateRiskControlMatrixOutputSchema>;

// Export RcmEntry type if needed by other components (e.g. RcmTable)
export type RcmEntry = z.infer<typeof RcmEntrySchema>;


// The main exported function that will be called by server actions
export async function generateRiskControlMatrix(
  input: GenerateRiskControlMatrixInput
): Promise<GenerateRiskControlMatrixOutput> {
  // Validate input using Zod schema
  const validatedInput = GenerateRiskControlMatrixInputSchema.parse(input);

  const { documentText, apiKey, modelName } = validatedInput;

  const promptText = `You are an expert auditor tasked with generating a Risk Control Matrix (RCM) from policy documents.

Analyze the provided policy document text, extract clauses, map them to relevant compliance standards (COSO, COBIT, ISO 27001, ISO 31000), 
and generate descriptions of controls, risks, and audit tests.

For each clause, create an RCM entry with the following fields:

- policyClauseId: A unique identifier for the clause (e.g., C001).
- policyClauseText: The verbatim text of the extracted policy clause.
- controlFramework: The compliance framework to which the control maps (e.g., COSO, COBIT, ISO 27001, ISO 31000).
- controlId: The identifier for the specific control within the chosen framework.
- controlType: Classify the control type as Preventive, Detective, Corrective, or Directive.
- mappingRationale: A one-sentence justification for the control mapping, citing the specific standard.
- controlDescription: An actionable objective of the control.
- riskRating: Assign a risk rating of High, Medium, or Low.
- identifiedRisk: Describe the risk (cause -> nature -> impact).
- auditTest: Propose an audit test to validate control effectiveness (data source, sampling, expected outcome).
- recommendedAction: Recommend an action to address the identified risk or control gap.

If the document text is very short (e.g., less than a few sentences), contains no clear policy statements, or is otherwise not suitable for RCM generation, you MUST return an empty "rcmEntries" array like this: { "rcmEntries": [] }. Do not attempt to generate entries from unsuitable text.

The policy document text is as follows:
---
${documentText}
---

IMPORTANT: Return ONLY the RCM in JSON format. The entire response must be a single JSON object matching this structure:
{ "rcmEntries": [ /* full RCM entries as described above, or an empty array if the document is not suitable */ ] }
Do NOT include any explanatory text, markdown formatting like \`\`\`json, or any other content before or after the JSON object. The response must be solely the JSON object itself.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
        'X-Title': 'Policy Compliance Analyzer',
      },
      body: JSON.stringify({
        model: modelName, 
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: "json_object" }, 
      }),
    });

    if (!response.ok) {
      const errorBodyText = await response.text();
      let detailedError = `OpenRouter API request failed with model ${modelName} (Status ${response.status})`;
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
      console.error('OpenRouter API Error Full Response:', response.status, errorBodyText);
      throw new Error(detailedError);
    }

    const result = await response.json();
    
    if (!result.choices || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
        console.error('Invalid response structure from OpenRouter:', result);
        throw new Error(`Received an invalid response structure from OpenRouter with model ${modelName}. The AI did not provide any content. Check API logs.`);
    }
    
    const assistantResponseText = result.choices[0].message.content;
    if (typeof assistantResponseText !== 'string' || assistantResponseText.trim() === "") {
        console.error('Empty or non-string content from OpenRouter assistant:', assistantResponseText);
        throw new Error(`Received empty or non-string content from the AI model ${modelName}.`);
    }

    let parsedJson;
    try {
        const cleanedResponseText = assistantResponseText.replace(/^```json\s*|```$/g, '').trim();
        if (cleanedResponseText === "") {
            throw new Error("AI returned an empty string after cleaning markdown.");
        }
        parsedJson = JSON.parse(cleanedResponseText);
    } catch (e: any) {
        console.error('Failed to parse JSON response from OpenRouter:', assistantResponseText, e);
        const snippet = assistantResponseText.substring(0, 200) + (assistantResponseText.length > 200 ? "..." : "");
        throw new Error(`Failed to parse the AI's JSON response with model ${modelName}. The AI might have returned malformed JSON or included extra text. Start of response: "${snippet}". Original parsing error: ${e.message}`);
    }
    
    const validatedOutput = GenerateRiskControlMatrixOutputSchema.parse(parsedJson);
    return validatedOutput;

  } catch (error: any) {
    console.error(`Error in generateRiskControlMatrix flow with model ${modelName}:`, error.name, error.message, error.stack);
    let finalErrorMessage: string;

    if (error.message?.startsWith("OpenRouter API request failed") || 
        error.message?.startsWith("Failed to parse the AI's JSON response") || 
        error.message?.startsWith("Received an invalid response structure") ||
        error.message?.startsWith("AI returned an empty string after cleaning markdown.") ||
        error.message?.startsWith("Received empty or non-string content")) {
        finalErrorMessage = error.message;
    } else if (error instanceof ZodError) {
      const issues = error.errors.map(err => `(${err.path.join('.')}: ${err.message})`).join(', ');
      finalErrorMessage = `AI response validation failed for model ${modelName}. Issues: ${issues}`;
    } else if (error instanceof Error) {
      finalErrorMessage = `Error during RCM generation with model ${modelName}: ${error.message}`;
    } else {
      finalErrorMessage = `An unknown error occurred during RCM generation with model ${modelName}.`;
    }
    throw new Error(finalErrorMessage);
  }
}
