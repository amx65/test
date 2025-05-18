'use server';

/**
 * @fileOverview Extracts clauses from a document and maps them to compliance standards.
 *
 * - extractClausesAndMapToStandards - A function that handles the clause extraction and mapping process.
 * - ExtractClausesAndMapToStandardsInput - The input type for the extractClausesAndMapToStandards function.
 * - ExtractClausesAndMapToStandardsOutput - The return type for the extractClausesAndMapToStandards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractClausesAndMapToStandardsInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A policy document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
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

const ExtractClausesAndMapToStandardsOutputSchema = z.object({
  rcmEntries: z.array(RcmEntrySchema).describe('An array of risk control matrix entries.'),
});
export type ExtractClausesAndMapToStandardsOutput = z.infer<typeof ExtractClausesAndMapToStandardsOutputSchema>;

export async function extractClausesAndMapToStandards(
  input: ExtractClausesAndMapToStandardsInput
): Promise<ExtractClausesAndMapToStandardsOutput> {
  return extractClausesAndMapToStandardsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractClausesAndMapToStandardsPrompt',
  input: {schema: ExtractClausesAndMapToStandardsInputSchema},
  output: {schema: ExtractClausesAndMapToStandardsOutputSchema},
  prompt: `You are an expert compliance officer.

You will analyze a policy document and extract key clauses, map them to relevant compliance standards (COSO, COBIT, ISO 27001, ISO 31000), and generate a Risk Control Matrix (RCM).

For each clause, you will determine the control framework, control ID, control type (Preventive, Detective, Corrective, Directive), mapping rationale (citing the standard), control description, risk rating (High, Medium, Low), identified risk (cause -> nature -> impact), audit test (data source, sampling, expected outcome), and recommended action.

Analyze the following policy document:

{{media url=documentDataUri}}

Return the RCM in JSON format:

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
  ]
}`,
});

const extractClausesAndMapToStandardsFlow = ai.defineFlow(
  {
    name: 'extractClausesAndMapToStandardsFlow',
    inputSchema: ExtractClausesAndMapToStandardsInputSchema,
    outputSchema: ExtractClausesAndMapToStandardsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
