
"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AppHeader from "@/components/AppHeader";
import ApiKeyForm from "@/components/ApiKeyForm";
import AuthSection from "@/components/AuthSection";
import FileUploadSection from "@/components/FileUploadSection";
import RcmDisplaySection from "@/components/RcmDisplaySection";
import type { GenerateRiskControlMatrixOutput } from "@/ai/flows/generate-risk-control-matrix";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type AppStep = "loading" | "apiKeyValidation" | "authentication" | "documentUpload" | "rcmDisplay";

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [rcmData, setRcmData] = useState<GenerateRiskControlMatrixOutput | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentStep === "loading") { // Initial load check
        if (openRouterApiKey) { // If API key was persisted/validated before
          setCurrentStep(currentUser ? "documentUpload" : "authentication");
        } else {
          setCurrentStep("apiKeyValidation");
        }
      } else if (currentStep === "authentication" && currentUser) {
         setCurrentStep("documentUpload");
      } else if (currentStep !== "apiKeyValidation" && !currentUser) {
        // If user signs out from other steps, move to auth
        setCurrentStep("authentication");
        setRcmData(null); // Clear RCM data on logout from RCM display
      }
    });
    return () => unsubscribe();
  }, [currentStep, openRouterApiKey]);


  const handleApiKeyValidated = (apiKey: string) => {
    setOpenRouterApiKey(apiKey);
    toast({ title: "API Key Validated", description: "You can now proceed to authentication." });
    if (user) {
      setCurrentStep("documentUpload");
    } else {
      setCurrentStep("authentication");
    }
  };

  const handleAuthSuccess = (authedUser: User) => {
    setUser(authedUser);
    toast({ title: "Authentication Successful", description: `Welcome, ${authedUser.displayName}!` });
    setCurrentStep("documentUpload");
  };

  const handleProcessingComplete = (data: GenerateRiskControlMatrixOutput, fileName: string) => {
    setRcmData(data);
    setCurrentFileName(fileName);
    toast({ title: "Processing Complete", description: "RCM has been generated successfully." });
    setCurrentStep("rcmDisplay");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRcmData(null); // Clear data on sign out
      setCurrentStep("authentication"); // Go to auth step after sign out
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ variant: "destructive", title: "Sign Out Error", description: "Failed to sign out." });
    }
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
      case "authentication":
        return <AuthSection onAuthSuccess={handleAuthSuccess} />;
      case "documentUpload":
        if (!user) { // Should not happen if logic is correct, but as a safeguard
            setCurrentStep("authentication");
            return null;
        }
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
      <AppHeader user={user} onSignOut={handleSignOut} />
      <main className="flex-grow container mx-auto px-4 py-8 md:px-8 md:py-12 flex flex-col items-center justify-center">
        {renderStep()}
      </main>
      <footer className="text-center p-4 text-sm text-muted-foreground border-t border-border">
        Policy Compliance Analyzer &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
