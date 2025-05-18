
"use client";

// Changed import to ExtractClausesAndMapToStandardsOutput
import type { ExtractClausesAndMapToStandardsOutput } from "@/ai/flows/extract-clauses-and-map-to-standards";
import RcmTable from "./RcmTable";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportRcmToCsv, exportRcmToExcel } from "@/lib/exportUtils";

interface RcmDisplaySectionProps {
  rcmData: ExtractClausesAndMapToStandardsOutput; // Updated type
  fileName: string; 
  onReset: () => void;
}

export default function RcmDisplaySection({ rcmData, fileName, onReset }: RcmDisplaySectionProps) {
  const baseExportName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

  const handleExportCsv = () => {
    exportRcmToCsv(rcmData.rcmEntries, `${baseExportName}_rcm.csv`);
  };

  const handleExportExcel = () => {
    exportRcmToExcel(rcmData.rcmEntries, `${baseExportName}_rcm.xlsx`);
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <CardTitle className="text-2xl">Risk Control Matrix (RCM)</CardTitle>
                <CardDescription>
                Generated RCM based on your document: <strong>{fileName}</strong>
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleExportCsv} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
                <Button onClick={handleExportExcel} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <RcmTable rcmEntries={rcmData.rcmEntries} />
        <Button onClick={onReset} variant="default" className="w-full md:w-auto">
            Analyze Another Document
        </Button>
      </CardContent>
    </Card>
  );
}

