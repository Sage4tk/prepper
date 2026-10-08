"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createEvent } from "@/lib/firebase/events";
import { createImportDoc, newImportId, saveExtractedItems, uploadImportPdf } from "@/lib/firebase/imports";
import { extractItemsFromPdf, MAX_PDF_BYTES } from "@/lib/pdf-extract";

export default function NewEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [client, setClient] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [step, setStep] = useState<"idle" | "creating" | "uploading" | "extracting">("idle");
  const [error, setError] = useState<string | null>(null);

  const submitting = step !== "idle";

  function handlePdfChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0] ?? null;
    if (file && file.size > MAX_PDF_BYTES) {
      setError("PDF is larger than the 20 MB limit.");
      changeEvent.target.value = "";
      setPdfFile(null);
      return;
    }
    setError(null);
    setPdfFile(file);
  }

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!user) return;

    setError(null);
    try {
      setStep("creating");
      const eventId = await createEvent(
        { name, date: new Date(date), venue, client },
        user.uid,
      );

      if (!pdfFile) {
        router.push(`/events/${eventId}`);
        return;
      }

      const importId = newImportId(eventId);

      setStep("uploading");
      const pdfPath = await uploadImportPdf(eventId, importId, pdfFile);
      await createImportDoc(eventId, importId, pdfPath);

      setStep("extracting");
      const items = await extractItemsFromPdf(pdfFile);
      await saveExtractedItems(eventId, importId, items);

      router.push(`/events/${eventId}/import/${importId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
      setStep("idle");
    }
  }

  if (!user) {
    return <p className="p-6 text-zinc-500">Sign in to create an event.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New event</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Event name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Date">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Venue">
          <input
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Client">
          <input
            required
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>

        <Field label="Equipment list PDF (optional)">
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfChange}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-zinc-800"
          />
          <span className="text-xs font-normal text-zinc-500">
            If attached, Claude extracts the items for you to review before they&apos;re added to the checklist.
          </span>
        </Field>

        {error ? <p className="text-sm text-status-missing">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {step === "creating" && "Creating event…"}
          {step === "uploading" && "Uploading PDF…"}
          {step === "extracting" && "Reading equipment list…"}
          {step === "idle" && "Create event"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
