"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { deleteItem, updateItem, type ItemFieldChange, type ItemSummary } from "@/lib/firebase/items";
import { getItemColor } from "@/lib/item-color";
import type { ItemColor, ItemStatus } from "@/types/models";

const COLOR_CLASSES: Record<ItemColor, string> = {
  green: "border-status-have/40 text-status-have",
  orange: "border-status-missing/40 text-status-missing",
  purple: "border-status-other-gig/40 text-status-other-gig",
  partial: "border-status-partial/40 text-status-partial",
};

export function ItemRow({
  eventId,
  item,
  canMark,
  canDelete,
}: {
  eventId: string;
  item: ItemSummary;
  canMark: boolean;
  canDelete: boolean;
}) {
  const { user } = useAuth();

  const color = getItemColor(item);
  const expanded = item.status === "other_gig";

  async function commit(patch: Record<string, unknown>, changes: ItemFieldChange[]) {
    if (!user) return;
    await updateItem(eventId, item.id, item.name, patch, changes, {
      uid: user.uid,
      name: user.displayName ?? user.email ?? "Unknown",
    });
  }

  function setStatus(next: ItemStatus) {
    if (next === item.status) {
      commit({ status: "unmarked", qtyHave: 0, qtyOnOtherGig: 0, otherGigName: "" }, [
        { field: "status", from: item.status, to: "unmarked" },
      ]);
      return;
    }

    if (next === "have") {
      commit({ status: "have", qtyHave: item.qtyNeeded }, [
        { field: "status", from: item.status, to: "have" },
      ]);
    } else if (next === "missing") {
      commit({ status: "missing" }, [{ field: "status", from: item.status, to: "missing" }]);
    } else if (next === "other_gig") {
      const defaultQty = Math.max(item.qtyNeeded - item.qtyHave, 0);
      commit({ status: "other_gig", qtyOnOtherGig: defaultQty }, [
        { field: "status", from: item.status, to: "other_gig" },
      ]);
    }
  }

  function adjustQtyHave(delta: number) {
    const next = Math.max(0, Math.min(item.qtyNeeded, item.qtyHave + delta));
    if (next === item.qtyHave) return;
    commit({ qtyHave: next }, [{ field: "qtyHave", from: item.qtyHave, to: next }]);
  }

  function adjustQtyOnOtherGig(delta: number) {
    const current = item.qtyOnOtherGig ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    commit({ qtyOnOtherGig: next }, [{ field: "qtyOnOtherGig", from: current, to: next }]);
  }

  function commitNotes(value: string) {
    if (value === (item.notes ?? "")) return;
    commit({ notes: value }, [{ field: "notes", from: item.notes ?? "", to: value }]);
  }

  function commitOtherGigName(value: string) {
    if (value === (item.otherGigName ?? "")) return;
    commit({ otherGigName: value }, [
      { field: "otherGigName", from: item.otherGigName ?? "", to: value },
    ]);
  }

  return (
    <li className={`rounded-lg border px-4 py-3 ${COLOR_CLASSES[color]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{item.name}</p>
          {canMark ? (
            <input
              key={item.notes ?? ""}
              defaultValue={item.notes ?? ""}
              onBlur={(e) => commitNotes(e.target.value)}
              placeholder="Add a note…"
              className="mt-0.5 w-full bg-transparent text-sm text-zinc-500 placeholder:text-zinc-400 focus:outline-none"
            />
          ) : item.notes ? (
            <p className="mt-0.5 text-sm text-zinc-500">{item.notes}</p>
          ) : null}
        </div>

        {canDelete ? (
          <button
            onClick={() => deleteItem(eventId, item.id)}
            className="shrink-0 text-xs text-zinc-400 hover:text-status-missing"
            aria-label={`Delete ${item.name}`}
          >
            Delete
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <StepperButton disabled={!canMark} onClick={() => adjustQtyHave(-1)} label="-" />
          <span className="min-w-18 text-center text-sm font-medium text-foreground">
            {item.qtyHave} / {item.qtyNeeded}
          </span>
          <StepperButton disabled={!canMark} onClick={() => adjustQtyHave(1)} label="+" />
        </div>

        {canMark ? (
          <div className="flex gap-1.5">
            <StatusButton active={item.status === "have"} onClick={() => setStatus("have")}>
              Have
            </StatusButton>
            <StatusButton active={item.status === "missing"} onClick={() => setStatus("missing")}>
              Missing
            </StatusButton>
            <StatusButton active={item.status === "other_gig"} onClick={() => setStatus("other_gig")}>
              Other gig
            </StatusButton>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-current/10 pt-2">
          <input
            key={item.otherGigName ?? ""}
            defaultValue={item.otherGigName ?? ""}
            onBlur={(e) => commitOtherGigName(e.target.value)}
            disabled={!canMark}
            placeholder="Which gig?"
            className="min-w-0 flex-1 rounded-md border border-current/20 bg-transparent px-2 py-1 text-sm text-foreground focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs">On other gig:</span>
            <StepperButton disabled={!canMark} onClick={() => adjustQtyOnOtherGig(-1)} label="-" />
            <span className="min-w-8 text-center text-sm font-medium text-foreground">
              {item.qtyOnOtherGig ?? 0}
            </span>
            <StepperButton disabled={!canMark} onClick={() => adjustQtyOnOtherGig(1)} label="+" />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function StatusButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-current text-white dark:text-black" : "bg-current/10"
      }`}
    >
      {children}
    </button>
  );
}

function StepperButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-current/10 text-sm font-semibold disabled:opacity-30"
      aria-label={label}
    >
      {label}
    </button>
  );
}
