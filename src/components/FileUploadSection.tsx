
"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";

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

export default function FileUploadSection({ openRouterApiKey, onProcessingComplete }: FileUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Drop your policy document here or click to select.");

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
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024*1024)}MB.`);
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

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    if (!openRouterApiKey) {
      setError("OpenRouter API Key is missing. Please re-validate your API key.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatusMessage("Preparing document...");

    try {
      setProgress(20);
      setStatusMessage("Converting document for analysis...");
      const documentDataUri = await fileToDataURL(file);
      
      setProgress(40);
      setStatusMessage("Sending document to AI for analysis... This may take a few minutes.");

      const { generateRcmAction } = await import("@/app/actions");
      // Simulate progress for AI processing
      // This interval is a rough estimate; actual processing time varies.
      let currentProgress = 40;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 2, 95); // Slower increment
        setProgress(currentProgress);
      }, 1500); // Longer interval

      // Pass both documentDataUri and openRouterApiKey
      const result = await generateRcmAction({ documentDataUri, openRouterApiKey });
      
      clearInterval(progressInterval); // Stop simulation

      if (result.data) {
        setProgress(100);
        setStatusMessage("Analysis complete!");
        onProcessingComplete(result.data, file.name);
      } else {
        throw new Error(result.error || "Failed to process document.");
      }
    } catch (err: any) {
      setProgress(0); // Reset progress on error
      console.error("Processing error:", err);
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

        {file && !isLoading && !error && (
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

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upload Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSubmit} disabled={!file || isLoading || !openRouterApiKey} className="w-full">
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
      </CardContent>
    </Card>
  );
}

