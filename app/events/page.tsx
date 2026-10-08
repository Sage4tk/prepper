"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeToUserEvents, type EventSummary } from "@/lib/firebase/events";

export default function EventsPage() {
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<EventSummary[] | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserEvents(user.uid, setEvents);
  }, [user]);

  if (loading) {
    return <p className="p-6 text-zinc-500">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Sign in to see your events.</p>
        <Link href="/" className="font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <Link
          href="/events/new"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          New event
        </Link>
      </div>

      {events === undefined ? (
        <p className="text-zinc-500">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-zinc-500">No events yet. Create one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex flex-col rounded-lg border border-black/[.08] px-4 py-3 transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                <span className="font-medium">{event.name}</span>
                <span className="text-sm text-zinc-500">
                  {event.venue} · {event.date.toDate().toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
