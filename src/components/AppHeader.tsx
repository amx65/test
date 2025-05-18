
"use client";

// Removed User import
import { ShieldCheck } from "lucide-react";
// Removed Button, Avatar, DropdownMenu components that were user-specific

interface AppHeaderProps {
  // Props are now empty as user and onSignOut are removed
}

export default function AppHeader({ }: AppHeaderProps) { // Removed user, onSignOut from props
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Policy Compliance Analyzer
          </h1>
        </div>
        {/* Removed user dropdown menu */}
      </div>
    </header>
  );
}
