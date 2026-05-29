// ============================================================
// CSV export
// ============================================================

export function generateCSV(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (val: string | number | null) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// PDF export usando jsPDF
// ============================================================

export async function generatePDF(options: {
  title: string;
  subtitle?: string;
  businessName: string;
  tables: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  doc.setFillColor(44, 24, 16); // brand-dark
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Primer crack OS", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(options.businessName, 14, 16);
  doc.text(options.title, 210 - 14, 10, { align: "right" });
  doc.text(new Date().toLocaleDateString("es-UY"), 210 - 14, 16, { align: "right" });

  let y = 30;

  if (options.subtitle) {
    doc.setTextColor(107, 87, 68);
    doc.setFontSize(10);
    doc.text(options.subtitle, 14, y);
    y += 8;
  }

  for (const table of options.tables) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setTextColor(28, 18, 8);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(table.title, 14, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [table.headers],
      body: table.rows,
      theme: "striped",
      headStyles: {
        fillColor: [44, 24, 16],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: [28, 18, 8] },
      alternateRowStyles: { fillColor: [253, 250, 246] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(160, 150, 140);
    doc.setFontSize(7);
    doc.text(
      `Primer crack OS · ${options.businessName} · Página ${i} de ${pageCount}`,
      14, 290
    );
  }

  return doc;
}
