
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck } from "lucide-react";
import { generateRcmAction } from "@/app/actions";
import type { GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";

const MOCK_DOCUMENT_TEXT = "This is a test policy. All employees must wear hats on Tuesdays. Data must be protected.";
const MOCK_MODEL_NAME = "deepseek/deepseek-chat-v3-0324:free";

// Helper to create a base64 data URI from text
function createTextDataUri(text: string): string {
  const base64Text = Buffer.from(text).toString('base64');
  return `data:text/plain;base64,${base64Text}`;
}

export default function TestPage() {
  const [apiKey, setApiKey] = useState<string>("");
  const [response, setResponse] = useState<GenerateRiskControlMatrixOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleTestSubmit = async () => {
    if (!apiKey) {
      setError("Please enter your OpenRouter API Key.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    const mockDocumentDataUri = createTextDataUri(MOCK_DOCUMENT_TEXT);

    try {
      const result = await generateRcmAction({
        documentDataUri: mockDocumentDataUri,
        openRouterApiKey: apiKey,
        modelName: MOCK_MODEL_NAME,
      });

      if (result.data) {
        setResponse(result.data);
      } else if (result.error) {
        setError(result.error);
      } else {
        setError("An unknown error occurred, and no data or error message was returned.");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected client-side error occurred during the test.");
      console.error("Test page submit error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              OpenRouter API Test Page
            </h1>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8 md:px-8 md:py-12 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-6 p-6 border rounded-lg shadow-md bg-card">
          <h2 className="text-2xl font-semibold text-center">Test OpenRouter Call</h2>
          <p className="text-sm text-muted-foreground text-center">
            This page calls the <code>generateRcmAction</code> with mock document text:
            <br />
            "<em>{MOCK_DOCUMENT_TEXT}</em>"
            <br />
            and model: <strong>{MOCK_MODEL_NAME}</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="apiKey">OpenRouter API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-base"
            />
          </div>
          <Button onClick={handleTestSubmit} disabled={isLoading} className="w-full">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Run Test Call
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
              <h3 className="font-semibold">Error:</h3>
              <pre className="whitespace-pre-wrap break-all text-sm">{error}</pre>
            </div>
          )}

          {response && (
            <div className="mt-4 p-4 bg-muted/50 border rounded-md">
              <h3 className="font-semibold">Response:</h3>
              <Textarea
                readOnly
                value={JSON.stringify(response, null, 2)}
                className="mt-2 min-h-[200px] max-h-[500px] text-sm bg-background font-mono"
                rows={15}
              />
            </div>
          )}
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        Test Page &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
