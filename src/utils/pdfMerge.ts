/**
 * PDF Merge Utility for Batch Label Printing
 * Uses pdf-lib for client-side PDF manipulation
 */

interface MergeResult {
  blob: Blob;
  pageCount: number;
}

/**
 * Fetches a PDF from a URL and returns its bytes
 */
async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Merges multiple PDF files into a single PDF
 * @param pdfUrls Array of PDF URLs to merge
 * @returns Promise with merged PDF blob and page count
 */
export async function mergePdfs(pdfUrls: string[]): Promise<MergeResult> {
  // Dynamically import pdf-lib to avoid issues with SSR
  const { PDFDocument } = await import('pdf-lib');
  
  // Create a new PDF document
  const mergedPdf = await PDFDocument.create();
  let totalPages = 0;

  for (const url of pdfUrls) {
    try {
      // Fetch PDF bytes
      const pdfBytes = await fetchPdfBytes(url);
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Copy all pages from the source PDF
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      
      // Add each page to the merged document
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
        totalPages++;
      }
    } catch (error) {
      console.error(`Failed to merge PDF from ${url}:`, error);
      // Continue with other PDFs even if one fails
    }
  }

  if (totalPages === 0) {
    throw new Error('No pages could be merged');
  }

  // Save the merged PDF
  const mergedPdfBytes = await mergedPdf.save();
  const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });

  return { blob, pageCount: totalPages };
}

/**
 * Opens a merged PDF in a new browser tab for printing
 */
export async function openMergedPdfForPrint(pdfUrls: string[]): Promise<void> {
  const { blob } = await mergePdfs(pdfUrls);
  const url = URL.createObjectURL(blob);
  
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Downloads a merged PDF file
 */
export async function downloadMergedPdf(pdfUrls: string[], filename = 'labels.pdf'): Promise<void> {
  const { blob } = await mergePdfs(pdfUrls);
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the object URL after a delay
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
