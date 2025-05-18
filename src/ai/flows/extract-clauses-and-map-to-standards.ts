
'use server';

/**
 * @fileOverview Extracts clauses from document text and maps them to compliance standards using OpenRouter.
 *
 * - extractClausesAndMapToStandards - A function that handles the clause extraction and mapping process.
 * - ExtractClausesAndMapToStandardsInput - The input type for the extractClausesAndMapToStandards function.
 * - ExtractClausesAndMapToStandardsOutput - The return type for the extractClausesAndMapToStandards function.
 */

import {z} from 'genkit';

const ExtractClausesAndMapToStandardsInputSchema = z.object({
  documentText: z
    .string()
    .describe('The full text content of the policy document.'),
  apiKey: z.string().describe('The OpenRouter API key.'),
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
  const { documentText, apiKey } = validatedInput;
  const openRouterModel = 'microsoft/mai-ds-r1:free';

  const promptText = `You are an expert compliance officer.

You will analyze the following policy document text and extract key clauses, map them to relevant compliance standards (COSO, COBIT, ISO 27001, ISO 31000), and generate a Risk Control Matrix (RCM).

For each clause, you will determine the control framework, control ID, control type (Preventive, Detective, Corrective, Directive), mapping rationale (citing the standard), control description, risk rating (High, Medium, Low), identified risk (cause -> nature -> impact), audit test (data source, sampling, expected outcome), and recommended action.

Policy document text:
---
${documentText}
---

Return the RCM in JSON format, ensuring the entire response is a single JSON object matching this structure:
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
Do not include any explanatory text before or after the JSON object.`;

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
        model: openRouterModel,
        messages: [{ role: 'user', content: promptText }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenRouter API Error:', response.status, errorBody);
      throw new Error(`OpenRouter API request failed: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();

    if (!result.choices || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
        console.error('Invalid response structure from OpenRouter:', result);
        throw new Error('Received an invalid response structure from OpenRouter.');
    }
    
    const assistantResponseText = result.choices[0].message.content;
    
    let parsedJson;
    try {
        const cleanedResponseText = assistantResponseText.replace(/^```json\s*|```$/g, '').trim();
        parsedJson = JSON.parse(cleanedResponseText);
    } catch (e: any) {
        console.error('Failed to parse JSON response from OpenRouter:', assistantResponseText, e);
        throw new Error(`Failed to parse the AI's JSON response. Raw response: ${assistantResponseText}`);
    }

    const validatedOutput = ExtractClausesAndMapToStandardsOutputSchema.parse(parsedJson);
    return validatedOutput;

  } catch (error: any) {
    console.error('Error in extractClausesAndMapToStandards flow:', error);
    throw new Error(`Failed to extract clauses via OpenRouter: ${error.message}`);
  }
}

// Note: This flow has been refactored to call OpenRouter directly.
// The original Genkit `ai.definePrompt` and `ai.defineFlow` are not used for this specific OpenRouter integration.
