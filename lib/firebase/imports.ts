import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { ImportDiff } from "@/lib/import-diff";
import { extractItemsFromPdf } from "@/lib/pdf-extract";
import type { ExtractedItem, ImportDoc, ImportStatus } from "@/types/models";

export interface ImportSummary extends ImportDoc {
  id: string;
}

export function newImportId(eventId: string): string {
  return doc(collection(db, "events", eventId, "imports")).id;
}

export async function uploadImportPdf(eventId: string, importId: string, file: File): Promise<string> {
  const path = `events/${eventId}/imports/${importId}.pdf`;
  await uploadBytes(ref(storage, path), file);
  return path;
}

export async function createImportDoc(
  eventId: string,
  importId: string,
  pdfPath: string,
  version = 1,
): Promise<void> {
  await setDoc(doc(db, "events", eventId, "imports", importId), {
    version,
    pdfPath,
    status: "processing" satisfies ImportStatus,
    extractedItems: [],
  });
}

export async function saveExtractedItems(eventId: string, importId: string, items: ExtractedItem[]): Promise<void> {
  await setDoc(
    doc(db, "events", eventId, "imports", importId),
    { extractedItems: items, status: "review" satisfies ImportStatus },
    { merge: true },
  );
}

export async function markImportFailed(eventId: string, importId: string): Promise<void> {
  await setDoc(
    doc(db, "events", eventId, "imports", importId),
    { status: "failed" satisfies ImportStatus },
    { merge: true },
  );
}

export function subscribeToImport(
  eventId: string,
  importId: string,
  callback: (importDoc: ImportSummary | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, "events", eventId, "imports", importId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...(snapshot.data() as ImportDoc) });
  });
}

const APPLY_CHUNK_SIZE = 450; // headroom under Firestore's 500-op batch limit

export async function applyImportItems(
  eventId: string,
  importId: string,
  items: ExtractedItem[],
  userUid: string,
): Promise<void> {
  for (let start = 0; start < items.length; start += APPLY_CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = items.slice(start, start + APPLY_CHUNK_SIZE);

    chunk.forEach((item, offset) => {
      const itemRef = doc(collection(db, "events", eventId, "items"));
      const payload: Record<string, unknown> = {
        name: item.name,
        section: item.section,
        notes: item.notes ?? "",
        sortOrder: start + offset,
        qtyNeeded: item.qtyNeeded,
        qtyHave: 0,
        status: "unmarked",
        updatedBy: userUid,
        updatedAt: serverTimestamp(),
      };
      if (item.sourceRef) {
        payload.sourceRef = item.sourceRef;
      }
      batch.set(itemRef, payload);
    });

    await batch.commit();
  }

  await setDoc(
    doc(db, "events", eventId, "imports", importId),
    { status: "applied" satisfies ImportStatus },
    { merge: true },
  );
}

/** Uploads a revised list, runs extraction, and returns the import to review. */
export async function startRevisionImport(eventId: string, file: File, version: number): Promise<string> {
  const importId = newImportId(eventId);
  const pdfPath = await uploadImportPdf(eventId, importId, file);
  await createImportDoc(eventId, importId, pdfPath, version);
  try {
    const items = await extractItemsFromPdf(file);
    await saveExtractedItems(eventId, importId, items);
  } catch (error) {
    await markImportFailed(eventId, importId);
    throw error;
  }
  return importId;
}

export interface RevisionSelection {
  diff: ImportDiff;
  /** Ids of removed items the admin chose to actually delete. */
  removeIds: Set<string>;
  /** Added rows the admin chose to keep. */
  addedIndexes: Set<number>;
}

/**
 * Applies a reviewed revision. Unchanged items are left alone so their
 * statuses survive; changed quantities are flagged for re-check rather than
 * silently keeping the old status. Every change gets an activity entry.
 */
export async function applyRevision(
  eventId: string,
  importId: string,
  version: number,
  selection: RevisionSelection,
  user: { uid: string; name: string },
  nextSortOrder: number,
): Promise<void> {
  const ops: ((batch: WriteBatch) => void)[] = [];

  function log(itemId: string, itemName: string, change: { field: string; from: unknown; to: unknown }) {
    ops.push((batch) =>
      batch.set(doc(collection(db, "events", eventId, "activity")), {
        itemId,
        itemName,
        userId: user.uid,
        userName: user.name,
        at: serverTimestamp(),
        change,
      }),
    );
  }

  for (const { existing, incoming } of selection.diff.changed) {
    const patch: Record<string, unknown> = {
      qtyNeeded: incoming.qtyNeeded,
      prevQtyNeeded: existing.qtyNeeded,
      needsRecheck: true,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    if ((existing.qtyHave ?? 0) > incoming.qtyNeeded) patch.qtyHave = incoming.qtyNeeded;
    ops.push((batch) => batch.update(doc(db, "events", eventId, "items", existing.id), patch));
    log(existing.id, existing.name, { field: "qtyNeeded", from: existing.qtyNeeded, to: incoming.qtyNeeded });
  }

  for (const { existing } of selection.diff.removed) {
    if (!selection.removeIds.has(existing.id)) continue;
    ops.push((batch) => batch.delete(doc(db, "events", eventId, "items", existing.id)));
    log(existing.id, existing.name, { field: "item", from: "on list", to: `removed in v${version}` });
  }

  let sortOrder = nextSortOrder;
  selection.diff.added.forEach(({ incoming }, index) => {
    if (!selection.addedIndexes.has(index)) return;
    const itemRef = doc(collection(db, "events", eventId, "items"));
    const payload: Record<string, unknown> = {
      name: incoming.name,
      section: incoming.section,
      notes: incoming.notes ?? "",
      sortOrder: sortOrder++,
      qtyNeeded: incoming.qtyNeeded,
      qtyHave: 0,
      status: "unmarked",
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    if (incoming.sourceRef) payload.sourceRef = incoming.sourceRef;
    ops.push((batch) => batch.set(itemRef, payload));
    log(itemRef.id, incoming.name, { field: "item", from: null, to: `added in v${version}` });
  });

  for (let start = 0; start < ops.length; start += APPLY_CHUNK_SIZE) {
    const batch = writeBatch(db);
    ops.slice(start, start + APPLY_CHUNK_SIZE).forEach((op) => op(batch));
    await batch.commit();
  }

  await setDoc(doc(db, "events", eventId), { listVersion: version }, { merge: true });
  await setDoc(
    doc(db, "events", eventId, "imports", importId),
    { status: "applied" satisfies ImportStatus },
    { merge: true },
  );
}
