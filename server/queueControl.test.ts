import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getQueuePreview: vi.fn(),
  callNextAppointment: vi.fn(),
  createAppointmentRequest: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";

const validInput = {
  fullName: "QA Queue Control",
  nik: "3201010101010001",
  birthPlace: "Kotabaru",
  birthDate: "1990-01-01",
  address: "Jl. Uji Coba No. 1, Kotabaru",
  religion: "Islam",
  contactNumber: "+6285215862526",
  service: "Poli Umum",
  preferredDate: "2026-09-28",
  preferredTime: "09:00 AM",
  complaint: "Keluhan untuk pengujian",
  consent: true as const,
};

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { ip: "203.0.113.42", socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("queue control router contract", () => {
  it("returns only a provisional queue number for the public preview", async () => {
    dbMocks.getQueuePreview.mockResolvedValueOnce(7);
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.appointments.queuePreview({ preferredDate: "2026-09-28" })).resolves.toBe(7);
    expect(dbMocks.getQueuePreview).toHaveBeenCalledWith("2026-09-28");
  });

  it("rejects malformed NIK before creating a public appointment", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.appointments.create({ ...validInput, nik: "not-16-digits" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createAppointmentRequest).not.toHaveBeenCalled();
  });

  it("keeps call-next restricted to administrators", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.appointments.callNext({ preferredDate: "2026-09-28" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.callNextAppointment).not.toHaveBeenCalled();
  });
});
