
"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileText, Loader2, AlertCircle, CheckCircle, BrainCircuit, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface FileUploadSectionProps {
  openRouterApiKey: string;
  onProcessingComplete: (data: GenerateRiskControlMatrixOutput, fileName: string) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

const AVAILABLE_MODELS = [
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek: DeepSeek V3 0324 (Free)" },
  { id: "microsoft/mai-ds-r1:free", name: "Microsoft: MAI DS R1 (Free)" },
  { id: "google/gemma-7b-it:free", name: "Google: Gemma 7B It (Free)" },
  { id: "mistralai/mistral-7b-instruct:free", name: "Mistral: Mistral 7B Instruct (Free)" },
  { id: "openchat/openchat-7b:free", name: "OpenChat: OpenChat 7B (Free)" },
  { id: "meta-llama/llama-3-8b-instruct:free", name: "Meta: Llama 3 8B Instruct (Free)"},
  { id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo:free", name: "Nous: Hermes 2 Mixtral 8x7B DPO (Free)"},
  { id: "gryphe/gryphe-mistral-7b-v2:free", name: "Gryphe: Mistral 7B v2 (Free)"},

];

export default function FileUploadSection({ openRouterApiKey, onProcessingComplete }: FileUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Drop your policy document here or click to select.");
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);

  const [isTestingModel, setIsTestingModel] = useState(false);
  const [modelTestError, setModelTestError] = useState<string | null>(null);
  const [isModelVerified, setIsModelVerified] = useState(false);
  const { toast } = useToast();

  const fileToDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      const firstRejection = fileRejections[0];
      if (firstRejection.errors[0].code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      } else if (firstRejection.errors[0].code === 'file-invalid-type') {
        setError("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      } else {
        setError(firstRejection.errors[0].message);
      }
      setFile(null);
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatusMessage(`Selected file: ${acceptedFiles[0].name}`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  useEffect(() => {
    const testModel = async () => {
      if (openRouterApiKey && selectedModel) {
        setIsTestingModel(true);
        setModelTestError(null);
        setIsModelVerified(false);
        try {
          const { testOpenRouterModel } = await import("@/app/actions");
          const result = await testOpenRouterModel(openRouterApiKey, selectedModel);
          if (result.success) {
            setIsModelVerified(true);
            toast({ title: "Model Verified", description: `${AVAILABLE_MODELS.find(m=>m.id === selectedModel)?.name || selectedModel} is working with your API key.`, variant: "default" });
          } else {
            setModelTestError(result.error || "Failed to verify model.");
            toast({ title: "Model Verification Failed", description: result.error || `Could not verify ${AVAILABLE_MODELS.find(m=>m.id === selectedModel)?.name || selectedModel}.`, variant: "destructive" });
          }
        } catch (e: any) {
          setModelTestError(`Error testing model: ${e.message}`);
          toast({ title: "Model Test Error", description: `An unexpected error occurred while testing the model. ${e.message}`, variant: "destructive" });
        } finally {
          setIsTestingModel(false);
        }
      } else {
        setIsModelVerified(false); // Reset if key or model is removed
        setModelTestError(null);
      }
    };
    testModel();
  }, [openRouterApiKey, selectedModel, toast]);


  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    if (!openRouterApiKey) {
      setError("OpenRouter API Key is missing. Please re-validate your API key.");
      return;
    }
    if (!selectedModel) {
      setError("Please select an AI model.");
      return;
    }
    if (!isModelVerified) {
      setError("Selected model is not verified with your API key. Please check the model or API key.");
      return;
    }

    setIsLoading(true);
    setError(null); // Clear general errors
    setProgress(0);
    setStatusMessage("Preparing document...");

    try {
      setProgress(20);
      setStatusMessage("Converting document for analysis...");
      const documentDataUri = await fileToDataURL(file);

      setProgress(40);
      setStatusMessage(`Sending document to AI (${AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}) for analysis... This may take a few minutes.`);

      const { generateRcmAction } = await import("@/app/actions");
      let currentProgress = 40;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 2, 95); // Stop at 95 to show completion after API call
        setProgress(currentProgress);
      }, 1500); // Simulate progress increase every 1.5s

      const result = await generateRcmAction({ documentDataUri, openRouterApiKey, modelName: selectedModel });

      clearInterval(progressInterval); // Stop simulation

      if (result.data) {
        setProgress(100);
        setStatusMessage("Analysis complete!");
        onProcessingComplete(result.data, file.name);
      } else {
        // Error from generateRcmAction
        throw new Error(result.error || "Failed to process document.");
      }
    } catch (err: any) {
      setProgress(0); // Reset progress on error
      console.error("Processing error:", err);
      // Set the general error state for display
      setError(err.message || "An unexpected error occurred during processing.");
      setStatusMessage("Processing failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <UploadCloud className="h-7 w-7 text-primary" />
          Upload Policy Document
        </CardTitle>
        <CardDescription>
          Upload your corporate policy (PDF, DOCX, or TXT - max 20MB).
          Note: PDF/DOCX processing is limited; prefer TXT for best results currently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="model-select" className="flex items-center gap-1">
            <BrainCircuit className="h-4 w-4" />
            Select AI Model
          </Label>
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!openRouterApiKey || isLoading}>
              <SelectTrigger id="model-select" className="w-full">
                <SelectValue placeholder="Choose an AI model" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {openRouterApiKey && ( // Only show test status if API key is present
                isTestingModel ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : isModelVerified ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
                ) : modelTestError ? (
                <TooltipProvider>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <XCircle className="h-5 w-5 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{modelTestError}</p>
                    </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                ) : selectedModel && ( // If model selected but no test outcome yet (e.g. initial load or key change)
                   <div className="h-5 w-5"></div> // Placeholder for alignment
                )
            )}
          </div>
           {!openRouterApiKey && <p className="text-xs text-muted-foreground">Enter API key to select and test models.</p>}
        </div>

        <div
          {...getRootProps()}
          className={`p-8 border-2 border-dashed rounded-md cursor-pointer transition-colors
            ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
            ${error ? "border-destructive" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <UploadCloud className={`h-12 w-12 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-muted-foreground">{statusMessage}</p>
            {!file && <p className="text-sm text-muted-foreground/80">Drag 'n' drop a file here, or click to select file</p>}
          </div>
        </div>

        {file && !isLoading && ( // Simplified: always show remove button if file and not loading
          <div className="p-3 bg-muted rounded-md border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setStatusMessage("Drop your policy document here or click to select."); setError(null); }}>
              Remove
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full h-3" />
            <p className="text-sm text-center text-muted-foreground">{statusMessage} ({progress}%)</p>
          </div>
        )}

        {error && ( // General error display
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSubmit} disabled={!file || isLoading || !openRouterApiKey || !selectedModel || !isModelVerified} className="w-full">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {isLoading ? "Processing..." : "Generate RCM"}
        </Button>
        {!openRouterApiKey && (
          <p className="text-sm text-center text-destructive">OpenRouter API Key is not set. Please validate your key first.</p>
        )}
         {openRouterApiKey && !isModelVerified && selectedModel && !isTestingModel && (
          <p className="text-sm text-center text-destructive">
            The selected model ({AVAILABLE_MODELS.find(m=>m.id === selectedModel)?.name || selectedModel}) could not be verified with your API key.
            {modelTestError ? ` Error: ${modelTestError}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

    