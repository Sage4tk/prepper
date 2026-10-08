"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToEvent, type EventSummary } from "@/lib/firebase/events";

export default function EventWorkspacePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventSummary | null | undefined>(undefined);

  useEffect(() => {
    return subscribeToEvent(eventId, setEvent);
  }, [eventId]);

  if (event === undefined) {
    return <p className="p-6 text-zinc-500">Loading…</p>;
  }

  if (event === null) {
    return <p className="p-6 text-zinc-500">Event not found, or you don&apos;t have access.</p>;
  }

  const role = user ? event.members[user.uid] : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
      <p className="mt-1 text-zinc-500">
        {event.venue} · {event.client} · {event.date.toDate().toLocaleDateString()}
      </p>
      <p className="mt-1 text-sm text-zinc-400">Your role: {role ?? "none"}</p>

      <div className="mt-8 rounded-lg border border-dashed border-black/[.1] p-6 text-sm text-zinc-500 dark:border-white/[.145]">
        The checklist UI (items grouped by section, status marking) is the next build step.
      </div>
    </div>
  );
}
