import { describe, expect, it } from "vitest";
import { buildOsdSnapshot, getWitaDateString } from "./db";

describe("OSD queue snapshot", () => {
  it("selects the lowest waiting queue as active and maps the doctor", () => {
    const snapshot = buildOsdSnapshot([
      { queueNumber: 4, fullName: "Budi", service: "Poli Gigi", assignedTime: "04:30 PM", status: "contacted" },
      { queueNumber: 2, fullName: "Sari", service: "Poli Umum", assignedTime: "09:00 AM", status: "new" },
      { queueNumber: 3, fullName: "Rina", service: "Poli Kandungan", assignedTime: "11:00 AM", status: "new" },
    ], "2026-09-05", "2026-09-05T01:00:00.000Z");

    expect(snapshot.active?.queueNumber).toBe(2);
    expect(snapshot.active?.doctor).toBe("Dr. Suriani");
    expect(snapshot.waiting.map(item => item.queueNumber)).toEqual([2, 3]);
    expect(snapshot.inTreatment.map(item => item.queueNumber)).toEqual([4]);
  });

  it("falls back to an in-treatment queue when nobody is waiting", () => {
    const snapshot = buildOsdSnapshot([
      { queueNumber: 7, fullName: "Dewi", service: "Poli Bedah", assignedTime: "10:00 AM", status: "contacted" },
    ], "2026-09-05");

    expect(snapshot.active?.queueNumber).toBe(7);
    expect(snapshot.active?.doctor).toBe("Dr. Uwais Sp.B");
    expect(snapshot.waiting).toHaveLength(0);
  });

  it("returns an empty display when there are no active records", () => {
    const snapshot = buildOsdSnapshot([], "2026-09-05");
    expect(snapshot.active).toBeNull();
    expect(snapshot.waiting).toEqual([]);
    expect(snapshot.inTreatment).toEqual([]);
  });

  it("formats the current date in WITA", () => {
    expect(getWitaDateString(new Date("2026-09-04T16:30:00.000Z"))).toBe("2026-09-05");
  });
});
