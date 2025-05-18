// src/ai/flows/generate-risk-control-matrix.ts
'use server';

/**
 * @fileOverview Generates a Risk Control Matrix (RCM) from policy documents by extracting clauses,
 * mapping them to compliance standards, and generating descriptions of controls, risks, and audit tests.
 *
 * - generateRiskControlMatrix - A function that orchestrates the RCM generation process.
 * - GenerateRiskControlMatrixInput - The input type for the generateRiskControlMatrix function, accepting a document data URI.
 * - GenerateRiskControlMatrixOutput - The return type for the generateRiskControlMatrix function, providing the RCM in JSON format.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRiskControlMatrixInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A policy document (PDF, DOCX, or TXT) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateRiskControlMatrixInput = z.infer<typeof GenerateRiskControlMatrixInputSchema>;

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

const GenerateRiskControlMatrixOutputSchema = z.object({
  rcmEntries: z.array(RcmEntrySchema).describe('Array of Risk Control Matrix entries.'),
});
export type GenerateRiskControlMatrixOutput = z.infer<typeof GenerateRiskControlMatrixOutputSchema>;

export async function generateRiskControlMatrix(
  input: GenerateRiskControlMatrixInput
): Promise<GenerateRiskControlMatrixOutput> {
  return generateRiskControlMatrixFlow(input);
}

const rcmPrompt = ai.definePrompt({
  name: 'rcmPrompt',
  input: {schema: GenerateRiskControlMatrixInputSchema},
  output: {schema: GenerateRiskControlMatrixOutputSchema},
  prompt: `You are an expert auditor tasked with generating a Risk Control Matrix (RCM) from policy documents.

  Analyze the provided policy document, extract clauses, map them to relevant compliance standards (COSO, COBIT, ISO 27001, ISO 31000), 
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

  The policy document is provided as a data URI:
  {{media url=documentDataUri}}

  Return the RCM in JSON format:
  { "rcmEntries": [ /* full entries including controlType */ ] }
  `,
});

const generateRiskControlMatrixFlow = ai.defineFlow(
  {
    name: 'generateRiskControlMatrixFlow',
    inputSchema: GenerateRiskControlMatrixInputSchema,
    outputSchema: GenerateRiskControlMatrixOutputSchema,
  },
  async input => {
    const {output} = await rcmPrompt(input);
    return output!;
  }
);
