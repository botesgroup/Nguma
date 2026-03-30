import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DOMPurify from "dompurify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * @param html The potentially unsafe HTML string.
 * @returns A sanitized HTML string.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html);
}

/**
 * Formats a number into a currency string.
 * @param amount The number to format.
 * @param currency The currency code (e.g., "USD").
 * @returns A formatted currency string.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = "USD") {
  const value = amount ?? 0; // Convert null or undefined to 0
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

/**
 * Formats a large number into a compact, readable string (e.g., 1.5K, 2M).
 * @param num The number to format.
 * @returns A compact string representation of the number.
 */
export function formatCompactNumber(num: number) {
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

/**
 * Generates and downloads a CSV file from an array of objects.
 * @param data The array of data to export.
 * @param headers An object mapping object keys to CSV header names.
 * @param filename The desired name of the downloaded file.
 */
export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  headers: Record<keyof T, string>,
  filename: string
): void {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const escapeField = (field: any): string => {
    const str = String(field ?? '');
    // Replace " with "" and wrap in "
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerRow = Object.values(headers).map(escapeField).join(',');
  const dataKeys = Object.keys(headers) as (keyof T)[];

  const csvRows = data.map(row =>
    dataKeys.map(key => escapeField(row[key])).join(',')
  );

  const csvContent = [headerRow, ...csvRows].join('\n');
  
  // Add BOM for UTF-8 compatibility with Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a styled PDF file from an array of objects.
 * @param data The array of data to export.
 * @param headers An object mapping object keys to CSV header names.
 * @param filename The desired name of the downloaded file.
 * @param title The title to display at the top of the PDF document.
 */
export function exportToPdf<T extends Record<string, any>>(
  data: T[],
  headers: Record<keyof T, string>,
  filename: string,
  title: string,
  columnStyles: any = {},
  summary?: { label: string; value: string }[]
): void {
  if (!data || data.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Set document title and date
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

  const tableHeaders = Object.values(headers);
  const dataKeys = Object.keys(headers) as (keyof T)[];
  const tableBody = data.map(row => dataKeys.map(key => String(row[key] ?? '')));

  // Convert key-based columnStyles to index-based for jspdf-autotable
  const indexedColumnStyles: { [key: number]: any } = {};
  Object.keys(columnStyles).forEach(key => {
    const index = dataKeys.indexOf(key as keyof T);
    if (index !== -1) {
      indexedColumnStyles[index] = columnStyles[key];
    }
  });

  autoTable(doc, {
    startY: 35,
    head: [tableHeaders],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [242, 242, 242] },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: indexedColumnStyles,
    didDrawPage: (data) => {
      // Draw summary only on the last page
      if (data.pageNumber === (doc as any).internal.getNumberOfPages()) {
        if (summary && summary.length > 0) {
          const tableBottomY = (data.cursor?.y || 0) + 5;
          const pageWidth = doc.internal.pageSize.getWidth();
          const summaryText = summary.map(s => `${s.label}: ${s.value}`).join('   |   ');
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(52, 73, 94); // Dark blue background
          doc.rect(14, tableBottomY, pageWidth - 28, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(summaryText, pageWidth / 2, tableBottomY + 6, { align: 'center' });
        }
      }
    },
  });

  doc.save(filename);
}
