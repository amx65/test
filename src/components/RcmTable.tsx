
"use client";

import type { RcmEntry } from "@/ai/flows/generate-risk-control-matrix";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface RcmTableProps {
  rcmEntries: RcmEntry[];
}

const riskRatingVariant = (rating: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (rating?.toLowerCase()) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary"; // Consider a yellow/orange if theme supports
    case "low":
      return "default"; // Consider a green if theme supports
    default:
      return "outline";
  }
};

const controlTypeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type?.toLowerCase()) {
      case "preventive":
        return "default";
      case "detective":
        return "secondary";
      case "corrective":
        return "default"; // Or another color
      case "directive":
        return "outline";
      default:
        return "outline";
    }
  };

export default function RcmTable({ rcmEntries }: RcmTableProps) {
  if (!rcmEntries || rcmEntries.length === 0) {
    return <p className="text-center text-muted-foreground">No RCM data to display.</p>;
  }

  return (
    <ScrollArea className="max-h-[400px] md:max-h-[600px] w-full rounded-md border shadow-md">
      <Table className="min-w-full relative">
        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
          <TableRow>
            <TableHead className="w-[80px]">Clause ID</TableHead>
            <TableHead className="min-w-[250px]">Policy Clause Text</TableHead>
            <TableHead className="w-[120px]">Framework</TableHead>
            <TableHead className="w-[100px]">Control ID</TableHead>
            <TableHead className="w-[120px]">Control Type</TableHead>
            <TableHead className="min-w-[200px]">Mapping Rationale</TableHead>
            <TableHead className="min-w-[200px]">Control Description</TableHead>
            <TableHead className="w-[100px]">Risk Rating</TableHead>
            <TableHead className="min-w-[250px]">Identified Risk</TableHead>
            <TableHead className="min-w-[250px]">Audit Test</TableHead>
            <TableHead className="min-w-[200px]">Recommended Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rcmEntries.map((entry) => (
            <TableRow key={entry.policyClauseId}>
              <TableCell className="font-medium">{entry.policyClauseId}</TableCell>
              <TableCell className="text-xs">{entry.policyClauseText}</TableCell>
              <TableCell>{entry.controlFramework}</TableCell>
              <TableCell>{entry.controlId}</TableCell>
              <TableCell>
                <Badge variant={controlTypeVariant(entry.controlType)} className="capitalize">
                  {entry.controlType}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{entry.mappingRationale}</TableCell>
              <TableCell className="text-xs">{entry.controlDescription}</TableCell>
              <TableCell>
                <Badge variant={riskRatingVariant(entry.riskRating)} className="capitalize">
                  {entry.riskRating}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{entry.identifiedRisk}</TableCell>
              <TableCell className="text-xs">{entry.auditTest}</TableCell>
              <TableCell className="text-xs">{entry.recommendedAction}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
