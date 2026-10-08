import type { ItemColor, ItemDoc } from "@/types/models";

/**
 * Derives the checklist color from status + quantities, per the item model:
 * green when fully in hand, orange for an uncovered shortfall, purple when
 * the shortfall is covered by gear on another gig, and partial for a mix.
 */
export function getItemColor(item: Pick<ItemDoc, "status" | "qtyNeeded" | "qtyHave" | "qtyOnOtherGig">): ItemColor {
  const qtyOnOtherGig = item.qtyOnOtherGig ?? 0;

  if (item.qtyHave >= item.qtyNeeded) {
    return "green";
  }

  if (qtyOnOtherGig > 0 && item.qtyHave > 0) {
    return "partial";
  }

  if (item.status === "other_gig" && item.qtyHave + qtyOnOtherGig >= item.qtyNeeded) {
    return "purple";
  }

  return "orange";
}
