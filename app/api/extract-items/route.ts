import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 120;

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const ExtractedItemSchema = z.object({
  name: z.string(),
  section: z.enum(["audio", "lighting", "video", "staging", "power", "other"]),
  qtyNeeded: z.number().int().min(1),
  notes: z.string().optional(),
  sourceRef: z
    .object({
      page: z.number().int(),
      line: z.number().int(),
    })
    .optional(),
});

const ExtractionResultSchema = z.object({
  items: z.array(ExtractedItemSchema),
});

const client = new Anthropic();

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : null;

  if (!pdfBase64) {
    return NextResponse.json({ error: "Missing pdfBase64 in request body." }, { status: 400 });
  }

  // Rough upper bound check on decoded size (base64 is ~4/3 the raw size).
  if (pdfBase64.length > (MAX_PDF_BYTES * 4) / 3) {
    return NextResponse.json({ error: "PDF is larger than the 20 MB limit." }, { status: 413 });
  }

  try {
    const response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            {
              type: "text",
              text: [
                "Extract every distinct equipment line item from this AV equipment list.",
                "For each item give:",
                "- name: the equipment name only, without a quantity prefix",
                "- section: your best guess of audio, lighting, video, staging, power (mains power cabling and distribution only, e.g. Socapex, CEEForm, TRUE1; not signal cables), or other, based on headers or context (default to 'other' if unclear)",
                "- qtyNeeded: an integer quantity needed (assume 1 if not specified)",
                "- notes: any extra detail on the line (model numbers, conditions) - omit if there is none",
                "- sourceRef: the 1-indexed page number and a line/row number within that page where the item appears",
                "Do not invent items that are not in the document. If a quantity is ambiguous, make your best reading and mention the ambiguity in notes.",
              ].join("\n"),
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(ExtractionResultSchema),
      },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "Claude did not return a parseable item list." }, { status: 502 });
    }

    return NextResponse.json({ items: response.parsed_output.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
