
"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import ApiKeyForm from "@/components/ApiKeyForm";
import FileUploadSection from "@/components/FileUploadSection";
import RcmDisplaySection from "@/components/RcmDisplaySection";
// Updated to import from extractClausesAndMapToStandards as generateRcmAction now returns its output type
import type { ExtractClausesAndMapToStandardsOutput } from "@/ai/flows/extract-clauses-and-map-to-standards";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type AppStep = "loading" | "apiKeyValidation" | "documentUpload" | "rcmDisplay";

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>("");
  const [rcmData, setRcmData] = useState<ExtractClausesAndMapToStandardsOutput | null>(null); // Updated type
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (currentStep === "loading") {
      if (openRouterApiKey) { 
        setCurrentStep("documentUpload");
      } else {
        setCurrentStep("apiKeyValidation");
      }
    }
  }, [currentStep, openRouterApiKey]);


  const handleApiKeyValidated = (apiKey: string) => {
    setOpenRouterApiKey(apiKey);
    toast({ title: "API Key Validated", description: "You can now proceed to document upload." });
    setCurrentStep("documentUpload"); 
  };


  const handleProcessingComplete = (data: ExtractClausesAndMapToStandardsOutput, fileName: string) => { // Updated type
    setRcmData(data);
    setCurrentFileName(fileName);
    toast({ title: "Processing Complete", description: "RCM has been generated successfully." });
    setCurrentStep("rcmDisplay");
  };
  
  const resetToUpload = () => {
    setRcmData(null);
    setCurrentFileName("");
    setCurrentStep("documentUpload");
  }

  const renderStep = () => {
    switch (currentStep) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading Application...</p>
          </div>
        );
      case "apiKeyValidation":
        return <ApiKeyForm onApiKeyValidated={handleApiKeyValidated} />;
      case "documentUpload":
        return <FileUploadSection openRouterApiKey={openRouterApiKey} onProcessingComplete={handleProcessingComplete} />;
      case "rcmDisplay":
        if (!rcmData) { 
            setCurrentStep("documentUpload");
            return null;
        }
        return <RcmDisplaySection rcmData={rcmData} fileName={currentFileName} onReset={resetToUpload} />;
      default:
        return <p>Unknown application state.</p>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8 md:px-8 md:py-12 flex flex-col items-center justify-center">
        {renderStep()}
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        Policy Compliance Analyzer &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

