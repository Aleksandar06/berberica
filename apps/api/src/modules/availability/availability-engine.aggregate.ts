/**
 * "Any available staff" aggregator.
 *
 * Composes `computeAvailableSlots` across multiple qualifying staff members
 * for the same (tenant, service, date). The Step-7 validator
 * `assertStaffCanPerformService` is the gate for whether a staff member
 * "qualifies" — this aggregator does NOT re-check, it just unions the
 * per-staff results into a single slot list, recording which staff are
 * free per slot.
 *
 * A slot is available if at least one staff member can take it. The
 * resulting `availableStaffMemberIds` is preserved so the booking flow
 * (Step 11) can pick deterministically (e.g. round-robin, least loaded,
 * or simply the first id) when the customer requests "any" staff.
 */
import {
  type AvailableSlot,
  type ComputeAvailableSlotsInput,
  computeAvailableSlots,
} from "./availability-engine";

export interface AnyStaffInput {
  staffMemberId: string;
  per: ComputeAvailableSlotsInput;
}

export interface AnyStaffSlot extends AvailableSlot {
  availableStaffMemberIds: string[];
}

export function computeAnyStaffSlots(inputs: ReadonlyArray<AnyStaffInput>): {
  slots: AnyStaffSlot[];
} {
  const merged = new Map<
    string,
    AvailableSlot & { staff: string[] }
  >();
  for (const { staffMemberId, per } of inputs) {
    const { slots } = computeAvailableSlots(per);
    for (const slot of slots) {
      const key = slot.startUtc;
      const existing = merged.get(key);
      if (existing) {
        if (!existing.staff.includes(staffMemberId))
          existing.staff.push(staffMemberId);
      } else {
        merged.set(key, { ...slot, staff: [staffMemberId] });
      }
    }
  }
  const slots: AnyStaffSlot[] = [...merged.values()]
    .map(({ staff, ...rest }) => ({
      ...rest,
      availableStaffMemberIds: staff,
    }))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return { slots };
}
