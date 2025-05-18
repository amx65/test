
import type { RcmEntry } from "@/ai/flows/generate-risk-control-matrix";

function escapeCsvCell(cellData: string | undefined | null): string {
  if (cellData === undefined || cellData === null) {
    return "";
  }
  const stringData = String(cellData);
  // If the stringData contains a comma, newline, or double quote, enclose it in double quotes
  if (stringData.includes(',') || stringData.includes('\n') || stringData.includes('"')) {
    // Escape existing double quotes by doubling them
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
}

export function exportRcmToCsv(rcmEntries: RcmEntry[], fileName: string = "rcm-export.csv") {
  if (!rcmEntries || rcmEntries.length === 0) {
    console.warn("No data to export.");
    return;
  }

  const headers = [
    "Policy Clause ID",
    "Policy Clause Text",
    "Control Framework",
    "Control ID",
    "Control Type",
    "Mapping Rationale",
    "Control Description",
    "Risk Rating",
    "Identified Risk",
    "Audit Test",
    "Recommended Action",
  ];

  const csvRows = [
    headers.join(','),
    ...rcmEntries.map(entry => [
      escapeCsvCell(entry.policyClauseId),
      escapeCsvCell(entry.policyClauseText),
      escapeCsvCell(entry.controlFramework),
      escapeCsvCell(entry.controlId),
      escapeCsvCell(entry.controlType),
      escapeCsvCell(entry.mappingRationale),
      escapeCsvCell(entry.controlDescription),
      escapeCsvCell(entry.riskRating),
      escapeCsvCell(entry.identifiedRisk),
      escapeCsvCell(entry.auditTest),
      escapeCsvCell(entry.recommendedAction),
    ].join(',')),
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Placeholder for Excel export - would require a library like 'xlsx'
export function exportRcmToExcel(rcmEntries: RcmEntry[], fileName: string = "rcm-export.xlsx") {
  console.warn("Excel export is not yet implemented. Use CSV export instead.");
  alert("Excel export is not yet implemented. Please use CSV export.");
  // Implementation would involve:
  // 1. Importing 'xlsx' library
  // 2. Creating a worksheet from rcmEntries
  // 3. Creating a workbook
  // 4. Writing the workbook to a file and triggering download
  // Example (pseudo-code):
  // import * as XLSX from 'xlsx';
  // const worksheet = XLSX.utils.json_to_sheet(rcmEntries);
  // const workbook = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(workbook, worksheet, "RCM Data");
  // XLSX.writeFile(workbook, fileName);
}
