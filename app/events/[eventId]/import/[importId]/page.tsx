"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ImportReview } from "@/components/import/ImportReview";
import { RevisionReview } from "@/components/import/RevisionReview";
import { subscribeToImport, type ImportSummary } from "@/lib/firebase/imports";

export default function ImportReviewPage() {
  const { eventId, importId } = useParams<{ eventId: string; importId: string }>();
  const [importDoc, setImportDoc] = useState<ImportSummary | null | undefined>(undefined);

  useEffect(() => {
    return subscribeToImport(eventId, importId, setImportDoc);
  }, [eventId, importId]);

  if (importDoc === undefined) {
    return <p className="p-6 text-zinc-500">Loading…</p>;
  }

  if (importDoc === null) {
    return <p className="p-6 text-zinc-500">Import not found, or you don&apos;t have access.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {importDoc.version > 1 ? `Review revised list (v${importDoc.version})` : "Review extracted items"}
      </h1>

      {importDoc.status === "applied" ? (
        <p className="text-zinc-500">This import was already applied to the checklist.</p>
      ) : importDoc.status === "failed" ? (
        <p className="text-status-missing">Extraction failed for this import.</p>
      ) : importDoc.version > 1 ? (
        <RevisionReview
          eventId={eventId}
          importId={importId}
          version={importDoc.version}
          extractedItems={importDoc.extractedItems}
        />
      ) : (
        <ImportReview eventId={eventId} importId={importId} extractedItems={importDoc.extractedItems} />
      )}
    </div>
  );
}
