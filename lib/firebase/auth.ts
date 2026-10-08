import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

const googleProvider = new GoogleAuthProvider();

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  await syncUserProfile(credential.user);
}

export async function signOutUser() {
  await signOut(auth);
}

async function syncUserProfile(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
