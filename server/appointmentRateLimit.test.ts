import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createAppointmentRequest: vi.fn(),
}));

const turnstileMocks = vi.hoisted(() => ({
  verifyTurnstileToken: vi.fn(),
  getTurnstileVerificationSecret: vi.fn(() => "test-secret"),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, createAppointmentRequest: dbMocks.createAppointmentRequest };
});

vi.mock("./turnstile", () => ({
  verifyTurnstileToken: turnstileMocks.verifyTurnstileToken,
  getTurnstileVerificationSecret: turnstileMocks.getTurnstileVerificationSecret,
}));

import { appointmentSubmissionRateLimiter } from "./appointmentRequest";
import { appRouter } from "./routers";

const input = {
  fullName: "QA Rate Limit",
  nik: "3201010101010001",
  birthPlace: "Kotabaru",
  birthDate: "1990-01-01",
  address: "Jl. Uji Coba No. 1, Kotabaru",
  religion: "Islam",
  contactNumber: "+6285215862526",
  service: "Poli Umum",
  preferredDate: "2026-08-26",
  preferredTime: "09:00 AM",
  consent: true as const,
  complaint: "Keluhan untuk pengujian",
};

function createContext(ip: string): TrpcContext {
  return {
    user: null,
    req: { ip, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("appointment create rate limiting", () => {
  beforeEach(() => {
    appointmentSubmissionRateLimiter.reset();
    dbMocks.createAppointmentRequest.mockReset();
    dbMocks.createAppointmentRequest.mockResolvedValue({ id: 150001, queueNumber: 1, preferredTime: "09:00 AM", assignedTime: "09:00 AM" });
    turnstileMocks.verifyTurnstileToken.mockReset();
    turnstileMocks.verifyTurnstileToken.mockResolvedValue({ success: true, errorCodes: [] });
  });

  it("allows normal submissions but rejects rapid fourth submission from the same IP", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.42"));

    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await expect(caller.appointments.create(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });

  it("allows a verified CAPTCHA fallback after rate limiting and rejects an invalid token", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.88"));
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);

    await expect(caller.appointments.create({ ...input, captchaToken: "verified-token" })).resolves.toEqual({
      success: true,
      requestId: 150001,
      queueNumber: 1,
      assignedTime: "09:00 AM",
    });
    expect(turnstileMocks.verifyTurnstileToken).toHaveBeenCalledWith("verified-token", "203.0.113.88", "test-secret");

    turnstileMocks.verifyTurnstileToken.mockResolvedValueOnce({ success: false, errorCodes: ["invalid-input-response"] });
    await expect(caller.appointments.create({ ...input, captchaToken: "invalid-token" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps the honeypot short-circuit intact without consuming a rate-limit slot", async () => {
    const caller = appRouter.createCaller(createContext("198.51.100.7"));

    await expect(caller.appointments.create({ ...input, website: "https://spam.example" })).resolves.toEqual({
      success: true,
      requestId: null,
    });
    expect(dbMocks.createAppointmentRequest).not.toHaveBeenCalled();

    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });
});
