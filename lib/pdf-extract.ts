import type { ExtractedItem } from "@/types/models";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function extractItemsFromPdf(file: File): Promise<ExtractedItem[]> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF is larger than the 20 MB limit.");
  }

  const pdfBase64 = await fileToBase64(file);

  const response = await fetch("/api/extract-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64 }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error ?? `Extraction failed (${response.status}).`);
  }

  return body.items as ExtractedItem[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
