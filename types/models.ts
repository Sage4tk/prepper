import type { Timestamp } from "firebase/firestore";

export type EventMemberRole = "admin" | "crew" | "viewer";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  updatedAt?: Timestamp;
}

export interface EventDoc {
  name: string;
  date: Timestamp;
  venue: string;
  client: string;
  createdBy: string;
  createdAt: Timestamp;
  members: Record<string, EventMemberRole>;
  sourcePdfPath?: string;
  listVersion: number;
  archived: boolean;
}

export type ItemSection = "audio" | "lighting" | "video" | "staging" | "other";

export type ItemStatus = "unmarked" | "have" | "missing" | "other_gig";

export interface ItemDoc {
  name: string;
  section: ItemSection;
  notes?: string;
  sortOrder: number;
  qtyNeeded: number;
  qtyHave: number;
  status: ItemStatus;
  otherGigId?: string;
  otherGigName?: string;
  qtyOnOtherGig?: number;
  expectedBack?: Timestamp;
  sourceRef?: {
    page: number;
    line: number;
  };
  updatedBy: string;
  updatedAt: Timestamp;
}

/** Derived display color — computed from status + quantities, never stored. */
export type ItemColor = "green" | "orange" | "purple" | "partial";

export interface ActivityLogEntry {
  itemId: string;
  itemName: string;
  userId: string;
  userName: string;
  at: Timestamp;
  change: {
    field: string;
    from: unknown;
    to: unknown;
  };
}

export type ImportStatus = "processing" | "review" | "applied" | "failed";

export interface ExtractedItem {
  name: string;
  section: ItemSection;
  qtyNeeded: number;
  notes?: string;
  sourceRef?: {
    page: number;
    line: number;
  };
}

export interface ImportDoc {
  version: number;
  pdfPath: string;
  status: ImportStatus;
  extractedItems: ExtractedItem[];
  diff?: {
    added: string[];
    removed: string[];
    changed: string[];
  };
}
