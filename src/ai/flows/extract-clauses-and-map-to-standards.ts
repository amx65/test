
'use server';

/**
 * @fileOverview Extracts clauses from document text and maps them to compliance standards using OpenRouter.
 *
 * - extractClausesAndMapToStandards - A function that handles the clause extraction and mapping process.
 * - ExtractClausesAndMapToStandardsInput - The input type for the extractClausesAndMapToStandards function.
 * - ExtractClausesAndMapToStandardsOutput - The return type for the extractClausesAndMapToStandards function.
 */

import {z, ZodError} from 'genkit';

const ExtractClausesAndMapToStandardsInputSchema = z.object({
  documentText: z
    .string()
    .describe('The full text content of the policy document.'),
  apiKey: z.string().describe('The OpenRouter API key.'),
  modelName: z.string().describe('The OpenRouter model name to use (e.g., deepseek/deepseek-chat-v3-0324:free).'),
});
export type ExtractClausesAndMapToStandardsInput = z.infer<typeof ExtractClausesAndMapToStandardsInputSchema>;

const RcmEntrySchema = z.object({
  policyClauseId: z.string().describe('A unique identifier for the policy clause (e.g., C001).'),
  policyClauseText: z.string().describe('The verbatim text of the policy clause.'),
  controlFramework: z.string().describe('The relevant compliance framework (COSO, COBIT, ISO 27001, ISO 31000).'),
  controlId: z.string().describe('The ID of the mapped control within the framework.'),
  controlType: z.enum(['Preventive', 'Detective', 'Corrective', 'Directive']).describe('The type of control.'),
  mappingRationale: z.string().describe('A one-sentence rationale for the mapping, citing the standard.'),
  controlDescription: z.string().describe('An actionable objective for the control.'),
  riskRating: z.enum(['High', 'Medium', 'Low']).describe('The risk rating associated with the clause.'),
  identifiedRisk: z.string().describe('A description of the identified risk (cause -> nature -> impact).'),
  auditTest: z.string().describe('A description of the audit test (data source, sampling, expected outcome).'),
  recommendedAction: z.string().describe('A recommendation for addressing the risk or improving the control.'),
});

// OutputSchema is no longer exported directly
const ExtractClausesAndMapToStandardsOutputSchema = z.object({
  rcmEntries: z.array(RcmEntrySchema).describe('An array of risk control matrix entries.'),
});
export type ExtractClausesAndMapToStandardsOutput = z.infer<typeof ExtractClausesAndMapToStandardsOutputSchema>;

export async function extractClausesAndMapToStandards(
  input: ExtractClausesAndMapToStandardsInput
): Promise<ExtractClausesAndMapToStandardsOutput> {
  const validatedInput = ExtractClausesAndMapToStandardsInputSchema.parse(input);
  const { documentText, apiKey, modelName } = validatedInput;

  const promptText = `You are an expert compliance officer.

You will analyze the following policy document text and extract key clauses, map them to relevant compliance standards (COSO, COBIT, ISO 27001, ISO 31000), and generate a Risk Control Matrix (RCM).

For each clause, you will determine the control framework, control ID, control type (Preventive, Detective, Corrective, Directive), mapping rationale (citing the standard), control description, risk rating (High, Medium, Low), identified risk (cause -> nature -> impact), audit test (data source, sampling, expected outcome), and recommended action.

Policy document text:
---
${documentText}
---

IMPORTANT: Return ONLY the RCM in JSON format. The entire response must be a single JSON object matching this structure:
{
  "rcmEntries": [
    {
      "policyClauseId": "C001",
      "policyClauseText": "The verbatim text of the policy clause.",
      "controlFramework": "COSO",
      "controlId": "ID-1",
      "controlType": "Preventive",
      "mappingRationale": "This control aligns with COSO principle 1.",
      "controlDescription": "Implement a process to prevent unauthorized access.",
      "riskRating": "High",
      "identifiedRisk": "Unauthorized access -> data breach -> financial loss.",
      "auditTest": "Review access logs for unauthorized access attempts.",
      "recommendedAction": "Implement multi-factor authentication."
    }
    // ... more entries
  ]
}
Do NOT include any explanatory text, markdown formatting like \`\`\`json, or any other content before or after the JSON object. The response must be solely the JSON object itself.`;

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
        throw new Error(`Failed to parse the AI's JSON response with model ${modelName}. The AI might have returned malformed JSON. Start of response: "${snippet}". Original parsing error: ${e.message}`);
    }

    const validatedOutput = ExtractClausesAndMapToStandardsOutputSchema.parse(parsedJson);
    return validatedOutput;

  } catch (error: any) {
    console.error(`Error in extractClausesAndMapToStandards flow with model ${modelName}:`, error.name, error.message, error.stack);
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
      finalErrorMessage = `Error during policy analysis with model ${modelName}: ${error.message}`;
    } else {
      finalErrorMessage = `An unknown error occurred during policy analysis with model ${modelName}.`;
    }
    throw new Error(finalErrorMessage);
  }
}
