"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { addItem } from "@/lib/firebase/items";
import type { ItemSection } from "@/types/models";

const SECTIONS: { value: ItemSection; label: string }[] = [
  { value: "audio", label: "Audio" },
  { value: "lighting", label: "Lighting" },
  { value: "video", label: "Video" },
  { value: "staging", label: "Staging" },
  { value: "power", label: "Power" },
  { value: "other", label: "Other" },
];

export function AddItemForm({ eventId, nextSortOrder }: { eventId: string; nextSortOrder: number }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [section, setSection] = useState<ItemSection>("audio");
  const [qtyNeeded, setQtyNeeded] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!user || !name.trim()) return;

    setSubmitting(true);
    try {
      await addItem(eventId, { name: name.trim(), section, qtyNeeded }, nextSortOrder, user.uid);
      setName("");
      setQtyNeeded(1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-black/[.1] p-3 dark:border-white/[.145]"
    >
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Item name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SM58 mic"
          className="rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Section</label>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as ItemSection)}
          className="rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
        >
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-20 flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Qty</label>
        <input
          type="number"
          min={1}
          value={qtyNeeded}
          onChange={(e) => setQtyNeeded(Math.max(1, Number(e.target.value)))}
          className="rounded-md border border-black/[.1] px-2 py-1.5 text-sm dark:border-white/[.145] dark:bg-[#111]"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
