# **App Name**: Policy Compliance Analyzer

## Core Features:

- API Key Validation: Validates the OpenRouter API key to ensure functionality.
- Google SSO: Enables secure user authentication using Google SSO via Firebase Auth.
- Document Upload & Chunking: Allows users to upload policy documents (PDF, DOCX, TXT) with chunking for large files.
- Clause Extraction & Mapping: Uses a generative AI tool to analyze uploaded documents, extract policy clauses, and map them to compliance standards. This tool reasons about COSO, COBIT, ISO 27001 and ISO 31000.
- RCM Generation & Export: Generates a Risk Control Matrix (RCM) in JSON format, including risk ratings, control descriptions, and audit tests.

## Style Guidelines:

- Primary color: A deep blue (#3F51B5) evokes trust and security, in alignment with the serious nature of policy and compliance.
- Background color: Light gray (#F0F2F5), nearly desaturated, to ensure comfortable readability of displayed content.
- Accent color: A purple hue (#8E24AA) that is analogous to blue, and has good saturation. Intended to make key actions, calls to action, and status indicators stand out.
- Clean and modern fonts for enhanced readability.
- Simple and clear icons to represent different compliance standards and risk levels.
- Clean and structured layout for easy navigation and data presentation.
- Subtle transitions and loading animations to provide feedback during document processing.