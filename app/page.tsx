"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { SignInButton } from "@/components/SignInButton";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">AV Prep</h1>
        <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
          Turn an equipment list into a shared checklist your crew marks up together, live.
        </p>
      </div>

      <SignInButton />

      {!loading && user ? (
        <Link
          href="/events"
          className="text-sm font-medium text-status-other-gig underline underline-offset-4"
        >
          Go to your events &rarr;
        </Link>
      ) : null}
    </div>
  );
}
