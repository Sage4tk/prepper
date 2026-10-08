import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
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

export async function createImportDoc(eventId: string, importId: string, pdfPath: string): Promise<void> {
  await setDoc(doc(db, "events", eventId, "imports", importId), {
    version: 1,
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
