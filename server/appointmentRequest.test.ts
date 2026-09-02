import { describe, expect, it } from "vitest";
import {
  AppointmentSubmissionRateLimiter,
  allocateAppointmentTime,
  formatPreferredTime,
  getClientIp,
  parsePreferredTime,
  isAutomatedAppointmentRequest,
  normalizeAppointmentNote,
} from "./appointmentRequest";

describe("appointment request privacy helpers", () => {
  it("parses and formats the localized 12-hour appointment time", () => {
    expect(parsePreferredTime("12:00 AM")).toBe(0);
    expect(parsePreferredTime("09:30 AM")).toBe(570);
    expect(parsePreferredTime("12:15 PM")).toBe(735);
    expect(formatPreferredTime(0)).toBe("12:00 AM");
    expect(formatPreferredTime(735)).toBe("12:15 PM");
    expect(() => parsePreferredTime("13:00 PM")).toThrow("XX:YY AM|PM");
  });

  it("moves later requests by 30 minutes for each occupied time", () => {
    expect(allocateAppointmentTime("09:00 AM", [])).toBe("09:00 AM");
    expect(allocateAppointmentTime("09:00 AM", ["09:00 AM"])).toBe("09:30 AM");
    expect(allocateAppointmentTime("09:00 AM", ["09:00 AM", "09:30 AM"])).toBe("10:00 AM");
    expect(allocateAppointmentTime("11:30 PM", ["11:30 PM", "12:00 AM"])).toBe("12:30 AM");
  });

  it("normalizes optional scheduling notes without retaining blank data", () => {
    expect(normalizeAppointmentNote("  Mohon   konfirmasi  jadwal. ")).toBe("Mohon konfirmasi jadwal.");
    expect(normalizeAppointmentNote("   ")).toBeNull();
  });

  it("detects a completed spam honeypot", () => {
    expect(isAutomatedAppointmentRequest("")).toBe(false);
    expect(isAutomatedAppointmentRequest("https://spam.example")).toBe(true);
  });

  it("allows normal submissions while rejecting rapid repeats from the same IP", () => {
    const limiter = new AppointmentSubmissionRateLimiter(3, 60_000);
    const clientIp = "203.0.113.42";

    expect(limiter.attempt(clientIp, 0).allowed).toBe(true);
    expect(limiter.attempt(clientIp, 1_000).allowed).toBe(true);
    expect(limiter.attempt(clientIp, 2_000).allowed).toBe(true);

    const blocked = limiter.attempt(clientIp, 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(57_000);

    expect(limiter.attempt("198.51.100.7", 3_000).allowed).toBe(true);
    expect(limiter.attempt(clientIp, 60_000).allowed).toBe(true);
  });

  it("uses Express's resolved client IP and falls back safely when unavailable", () => {
    expect(getClientIp({ ip: "203.0.113.42", socket: { remoteAddress: "127.0.0.1" } })).toBe("203.0.113.42");
    expect(getClientIp({ socket: { remoteAddress: "198.51.100.7" } })).toBe("198.51.100.7");
    expect(getClientIp({})).toBe("unknown");
  });

  it("prunes expired clients and caps the number of tracked IPs", () => {
    const limiter = new AppointmentSubmissionRateLimiter(3, 60_000, 2);

    limiter.attempt("203.0.113.1", 0);
    limiter.attempt("203.0.113.2", 1);
    limiter.attempt("203.0.113.3", 2);
    expect(limiter.activeClientCount).toBe(2);

    limiter.attempt("203.0.113.4", 60_002);
    expect(limiter.activeClientCount).toBe(1);
  });
});
