"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { applyImportItems } from "@/lib/firebase/imports";
import type { ExtractedItem, ItemSection } from "@/types/models";

const SECTIONS: { value: ItemSection; label: string }[] = [
  { value: "audio", label: "Audio" },
  { value: "lighting", label: "Lighting" },
  { value: "video", label: "Video" },
  { value: "staging", label: "Staging" },
  { value: "power", label: "Power" },
  { value: "other", label: "Other" },
];

export function ImportReview({
  eventId,
  importId,
  extractedItems,
}: {
  eventId: string;
  importId: string;
  extractedItems: ExtractedItem[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ExtractedItem[]>(() => extractedItems);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<ExtractedItem>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((current) => [...current, { name: "", section: "other", qtyNeeded: 1 }]);
  }

  async function handleApply() {
    if (!user) return;
    const validRows = rows.filter((row) => row.name.trim().length > 0);

    setApplying(true);
    setError(null);
    try {
      await applyImportItems(eventId, importId, validRows, user.uid);
      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply items.");
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Review what Claude pulled from the PDF before it&apos;s added to the checklist. Fix anything that&apos;s
        wrong, remove junk rows, or add items it missed.
      </p>

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex flex-wrap items-start gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]"
          >
            <input
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              placeholder="Item name"
              className="min-w-40 flex-1 rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
            />
            <select
              value={row.section}
              onChange={(e) => updateRow(index, { section: e.target.value as ItemSection })}
              className="rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={row.qtyNeeded}
              onChange={(e) => updateRow(index, { qtyNeeded: Math.max(1, Number(e.target.value)) })}
              className="w-20 rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
            />
            <input
              value={row.notes ?? ""}
              onChange={(e) => updateRow(index, { notes: e.target.value })}
              placeholder="Notes"
              className="min-w-32 flex-1 rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
            />
            {row.sourceRef ? (
              <span className="self-center text-xs text-zinc-400">
                p.{row.sourceRef.page} l.{row.sourceRef.line}
              </span>
            ) : null}
            <button
              onClick={() => removeRow(index)}
              className="self-center text-xs text-zinc-400 hover:text-status-missing"
              aria-label={`Remove ${row.name || "row"}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="self-start rounded-full border border-dashed border-black/[.15] px-4 py-1.5 text-sm font-medium text-zinc-500 dark:border-white/[.2]"
      >
        + Add item
      </button>

      {error ? <p className="text-sm text-status-missing">{error}</p> : null}

      <div className="flex gap-3">
        <button
          onClick={handleApply}
          disabled={applying || rows.length === 0}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {applying ? "Adding to checklist…" : `Add ${rows.length} items to checklist`}
        </button>
      </div>
    </div>
  );
}
