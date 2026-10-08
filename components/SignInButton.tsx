"use client";

import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";

export function SignInButton() {
  const { user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <div className="h-10 w-28 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />;
  }

  if (!user) {
    return (
      <button
        onClick={() => signIn()}
        className="flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.photoURL ? (
        <Image
          src={user.photoURL}
          alt={user.displayName ?? "Signed in user"}
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : null}
      <span className="text-sm font-medium">{user.displayName ?? user.email}</span>
      <button
        onClick={() => signOut()}
        className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        Sign out
      </button>
    </div>
  );
}
