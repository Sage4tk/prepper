"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { startRevisionImport } from "@/lib/firebase/imports";
import { MAX_PDF_BYTES } from "@/lib/pdf-extract";

export function RevisionUpload({ eventId, currentVersion }: { eventId: string; currentVersion: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setError("PDF is larger than the 20 MB limit.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const importId = await startRevisionImport(eventId, file, currentVersion + 1);
      router.push(`/events/${eventId}/import/${importId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the revised list.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <input ref={inputRef} type="file" accept="application/pdf" onChange={handleChange} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-full border border-black/[.15] px-4 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-white/[.2]"
      >
        {busy ? "Reading revised list…" : `Upload revised list (v${currentVersion + 1})`}
      </button>
      {error ? <p className="mt-2 text-sm text-status-missing">{error}</p> : null}
    </div>
  );
}
