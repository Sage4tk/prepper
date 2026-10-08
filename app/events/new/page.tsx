"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createEvent } from "@/lib/firebase/events";

export default function NewEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [client, setClient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);
    try {
      const eventId = await createEvent(
        { name, date: new Date(date), venue, client },
        user.uid,
      );
      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
      setSubmitting(false);
    }
  }

  if (!user) {
    return <p className="p-6 text-zinc-500">Sign in to create an event.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New event</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Event name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Date">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Venue">
          <input
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>
        <Field label="Client">
          <input
            required
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="rounded-md border border-black/[.1] px-3 py-2 dark:border-white/[.145] dark:bg-[#111]"
          />
        </Field>

        {error ? <p className="text-sm text-status-missing">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create event"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
