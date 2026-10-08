import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { EventDoc, EventMemberRole } from "@/types/models";

export interface NewEventInput {
  name: string;
  date: Date;
  venue: string;
  client: string;
}

export async function createEvent(input: NewEventInput, creatorUid: string): Promise<string> {
  const docRef = await addDoc(collection(db, "events"), {
    name: input.name,
    date: Timestamp.fromDate(input.date),
    venue: input.venue,
    client: input.client,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    members: { [creatorUid]: "admin" satisfies EventMemberRole },
    listVersion: 1,
    archived: false,
  });
  return docRef.id;
}

export interface EventSummary extends EventDoc {
  id: string;
}

/**
 * Sorts client-side rather than adding `orderBy("date")` to the query, which
 * would need a composite index alongside the dynamic `members.{uid}` filter.
 */
export function subscribeToUserEvents(uid: string, callback: (events: EventSummary[]) => void): Unsubscribe {
  const memberRoles: EventMemberRole[] = ["admin", "crew", "viewer"];
  const eventsQuery = query(collection(db, "events"), where(`members.${uid}`, "in", memberRoles));

  return onSnapshot(eventsQuery, (snapshot) => {
    const events = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as EventDoc),
    }));
    events.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    callback(events);
  });
}

export function subscribeToEvent(eventId: string, callback: (event: EventSummary | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "events", eventId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...(snapshot.data() as EventDoc) });
  });
}
