
"use client";

import { useState, useEffect } from "react";
// Removed User import from firebase/auth
// Removed auth import from @/lib/firebase
// Removed onAuthStateChanged, signOut imports from firebase/auth
import AppHeader from "@/components/AppHeader";
import ApiKeyForm from "@/components/ApiKeyForm";
// Removed AuthSection import
import FileUploadSection from "@/components/FileUploadSection";
import RcmDisplaySection from "@/components/RcmDisplaySection";
import type { GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// AppStep type updated to remove "authentication"
type AppStep = "loading" | "apiKeyValidation" | "documentUpload" | "rcmDisplay";

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>("");
  // Removed user state
  const [rcmData, setRcmData] = useState<GenerateRiskControlMatrixOutput | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (currentStep === "loading") {
      if (openRouterApiKey) { // If API key was somehow already set (e.g. HMR)
        setCurrentStep("documentUpload");
      } else {
        setCurrentStep("apiKeyValidation");
      }
    }
    // Removed onAuthStateChanged listener and related logic
  }, [currentStep, openRouterApiKey]);


  const handleApiKeyValidated = (apiKey: string) => {
    setOpenRouterApiKey(apiKey);
    toast({ title: "API Key Validated", description: "You can now proceed to document upload." });
    setCurrentStep("documentUpload"); // Directly go to document upload
  };

  // Removed handleAuthSuccess function

  const handleProcessingComplete = (data: GenerateRiskControlMatrixOutput, fileName: string) => {
    setRcmData(data);
    setCurrentFileName(fileName);
    toast({ title: "Processing Complete", description: "RCM has been generated successfully." });
    setCurrentStep("rcmDisplay");
  };

  // Removed handleSignOut function
  
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
      // Removed "authentication" case
      case "documentUpload":
        // Removed user check, directly return FileUploadSection
        return <FileUploadSection openRouterApiKey={openRouterApiKey} onProcessingComplete={handleProcessingComplete} />;
      case "rcmDisplay":
        if (!rcmData) { // Should not happen
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
      {/* Removed user and onSignOut props from AppHeader */}
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
