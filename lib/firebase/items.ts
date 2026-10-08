import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ItemDoc, ItemSection, ItemStatus } from "@/types/models";

export interface ItemSummary extends ItemDoc {
  id: string;
}

export function subscribeToItems(eventId: string, callback: (items: ItemSummary[]) => void): Unsubscribe {
  const itemsQuery = query(collection(db, "events", eventId, "items"), orderBy("sortOrder"));
  return onSnapshot(itemsQuery, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as ItemDoc) })));
  });
}

export interface NewItemInput {
  name: string;
  section: ItemSection;
  qtyNeeded: number;
  notes?: string;
}

export async function addItem(
  eventId: string,
  input: NewItemInput,
  sortOrder: number,
  userUid: string,
): Promise<void> {
  await addDoc(collection(db, "events", eventId, "items"), {
    name: input.name,
    section: input.section,
    notes: input.notes ?? "",
    sortOrder,
    qtyNeeded: input.qtyNeeded,
    qtyHave: 0,
    status: "unmarked" satisfies ItemStatus,
    updatedBy: userUid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteItem(eventId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, "events", eventId, "items", itemId));
}

export interface ItemFieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/**
 * Writes the item update and its activity log entries in one batch, so the
 * log can never drift from what's on the item (plan section 5).
 */
export async function updateItem(
  eventId: string,
  itemId: string,
  itemName: string,
  patch: Partial<ItemDoc>,
  changes: ItemFieldChange[],
  user: { uid: string; name: string },
): Promise<void> {
  const batch = writeBatch(db);

  const itemRef = doc(db, "events", eventId, "items", itemId);
  batch.update(itemRef, { ...patch, updatedBy: user.uid, updatedAt: serverTimestamp() });

  for (const change of changes) {
    const logRef = doc(collection(db, "events", eventId, "activity"));
    batch.set(logRef, {
      itemId,
      itemName,
      userId: user.uid,
      userName: user.name,
      at: serverTimestamp(),
      change,
    });
  }

  await batch.commit();
}
