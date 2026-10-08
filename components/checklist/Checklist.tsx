"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToItems, type ItemSummary } from "@/lib/firebase/items";
import { getItemColor } from "@/lib/item-color";
import type { EventMemberRole, ItemSection } from "@/types/models";
import { AddItemForm } from "./AddItemForm";
import { ItemRow } from "./ItemRow";

const SECTION_ORDER: ItemSection[] = ["audio", "lighting", "video", "staging", "other"];
const SECTION_LABELS: Record<ItemSection, string> = {
  audio: "Audio",
  lighting: "Lighting",
  video: "Video",
  staging: "Staging",
  other: "Other",
};

type Filter = "all" | "unmarked" | "missing" | "other_gig" | "mine";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unmarked", label: "Unmarked" },
  { value: "missing", label: "Missing" },
  { value: "other_gig", label: "Other gig" },
  { value: "mine", label: "Mine" },
];

export function Checklist({ eventId, role }: { eventId: string; role: EventMemberRole | undefined }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemSummary[] | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>("all");

  const isAdmin = role === "admin";
  const canMark = role === "admin" || role === "crew";

  useEffect(() => {
    return subscribeToItems(eventId, setItems);
  }, [eventId]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    switch (filter) {
      case "unmarked":
        return items.filter((item) => item.status === "unmarked");
      case "missing":
        return items.filter((item) => getItemColor(item) === "orange");
      case "other_gig":
        return items.filter((item) => item.status === "other_gig");
      case "mine":
        return items.filter((item) => item.updatedBy === user?.uid);
      default:
        return items;
    }
  }, [items, filter, user]);

  const progress = useMemo(() => {
    if (!items || items.length === 0) return 0;
    const resolved = items.filter((item) => item.status !== "unmarked").length;
    return Math.round((resolved / items.length) * 100);
  }, [items]);

  if (items === undefined) {
    return <p className="text-zinc-500">Loading checklist…</p>;
  }

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: filteredItems.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-6 bg-zinc-50/95 px-6 py-3 backdrop-blur dark:bg-black/95">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-status-have transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {progress}% resolved · {items.length} items
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-foreground text-background"
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isAdmin ? <AddItemForm eventId={eventId} nextSortOrder={items.length} /> : null}

      {grouped.length === 0 ? (
        <p className="text-zinc-500">No items match this filter.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.section}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {SECTION_LABELS[group.section]}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <ItemRow key={item.id} eventId={eventId} item={item} canMark={canMark} canDelete={isAdmin} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
