"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { applyRevision } from "@/lib/firebase/imports";
import { subscribeToItems, type ItemSummary } from "@/lib/firebase/items";
import { diffItems } from "@/lib/import-diff";
import type { ExtractedItem } from "@/types/models";

export function RevisionReview({
  eventId,
  importId,
  version,
  extractedItems,
}: {
  eventId: string;
  importId: string;
  version: number;
  extractedItems: ExtractedItem[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemSummary[] | undefined>(undefined);
  const [removeIds, setRemoveIds] = useState<Set<string> | null>(null);
  const [skippedAdds, setSkippedAdds] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToItems(eventId, setItems), [eventId]);

  const diff = useMemo(() => (items ? diffItems(items, extractedItems) : null), [items, extractedItems]);

  if (!items || !diff) {
    return <p className="text-zinc-500">Comparing with the current checklist…</p>;
  }

  // Removed items default to "remove"; the admin opts individual ones out.
  const effectiveRemoveIds = removeIds ?? new Set(diff.removed.map((entry) => entry.existing.id));
  const addedIndexes = new Set(diff.added.map((_, i) => i).filter((i) => !skippedAdds.has(i)));
  const nothingToApply = diff.changed.length + effectiveRemoveIds.size + addedIndexes.size === 0;

  function toggleRemove(id: string) {
    const next = new Set(effectiveRemoveIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRemoveIds(next);
  }

  function toggleAdd(index: number) {
    const next = new Set(skippedAdds);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSkippedAdds(next);
  }

  async function handleApply() {
    if (!user || !diff || !items) return;
    setApplying(true);
    setError(null);
    try {
      await applyRevision(
        eventId,
        importId,
        version,
        { diff, removeIds: effectiveRemoveIds, addedIndexes },
        { uid: user.uid, name: user.displayName ?? user.email ?? "Unknown" },
        items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0),
      );
      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply the revision.");
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-500">
        Version {version} compared with the current checklist. Statuses on unchanged items are kept. Items whose
        quantity changed are flagged <strong>needs re-check</strong> instead of keeping their old status.
      </p>

      <Group title="Quantity changed" count={diff.changed.length} empty="No quantity changes.">
        {diff.changed.map(({ existing, incoming }) => (
          <Row key={existing.id} name={existing.name}>
            <span className="text-sm font-medium text-status-partial">
              {existing.qtyNeeded} → {incoming.qtyNeeded}
            </span>
          </Row>
        ))}
      </Group>

      <Group title="New" count={diff.added.length} empty="Nothing new.">
        {diff.added.map(({ incoming }, index) => (
          <Row key={index} name={incoming.name} detail={`${incoming.section} · qty ${incoming.qtyNeeded}`}>
            <Toggle checked={addedIndexes.has(index)} onChange={() => toggleAdd(index)} label="Add" />
          </Row>
        ))}
      </Group>

      <Group title="Removed from list" count={diff.removed.length} empty="Nothing removed.">
        {diff.removed.map(({ existing }) => (
          <Row key={existing.id} name={existing.name} detail={`qty ${existing.qtyNeeded}`}>
            <Toggle
              checked={effectiveRemoveIds.has(existing.id)}
              onChange={() => toggleRemove(existing.id)}
              label="Remove"
            />
          </Row>
        ))}
      </Group>

      <p className="text-sm text-zinc-500">{diff.unchanged.length} items unchanged.</p>

      {error ? <p className="text-sm text-status-missing">{error}</p> : null}

      <div>
        <button
          onClick={handleApply}
          disabled={applying || nothingToApply}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {applying ? "Applying…" : nothingToApply ? "No changes to apply" : `Apply version ${version}`}
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title} ({count})
      </h2>
      {count === 0 ? <p className="text-sm text-zinc-400">{empty}</p> : <div className="flex flex-col gap-2">{children}</div>}
    </section>
  );
}

function Row({ name, detail, children }: { name: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/[.08] px-3 py-2 dark:border-white/[.145]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {detail ? <p className="text-xs text-zinc-500">{detail}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
