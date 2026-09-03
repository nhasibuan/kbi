export function normalizeAppointmentNote(note?: string | null) {
  const normalized = note?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function isAutomatedAppointmentRequest(honeypot?: string | null) {
  return Boolean(honeypot?.trim());
}

export const APPOINTMENT_RATE_LIMIT_WINDOW_MS = 60_000;
export const APPOINTMENT_RATE_LIMIT_MAX_REQUESTS = 3;

type RequestIpSource = {
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
};

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

/**
 * Uses Express's resolved `req.ip`, which respects the app's trusted-proxy
 * setting. The address is held only in process memory for the active window
 * and is never saved with appointment data.
 */
export function getClientIp(request: RequestIpSource): string {
  const ip = request.ip?.trim() || request.socket?.remoteAddress?.trim();
  return ip || "unknown";
}

export class AppointmentSubmissionRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests = APPOINTMENT_RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = APPOINTMENT_RATE_LIMIT_WINDOW_MS,
    private readonly maxEntries = 10_000,
  ) {}

  attempt(clientIp: string, now = Date.now()): RateLimitResult {
    this.pruneExpired(now);
    const key = clientIp || "unknown";
    const existing = this.entries.get(key);

    if (!existing || now - existing.windowStartedAt >= this.windowMs) {
      if (!existing && this.entries.size >= this.maxEntries) this.evictOldestEntry();
      this.entries.set(key, { count: 1, windowStartedAt: now });
      return { allowed: true, retryAfterMs: 0 };
    }

    const retryAfterMs = Math.max(0, this.windowMs - (now - existing.windowStartedAt));
    if (existing.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs };
    }

    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  reset() {
    this.entries.clear();
  }

  get activeClientCount() {
    return this.entries.size;
  }

  private pruneExpired(now: number) {
    const expiredClientIps = Array.from(this.entries.entries())
      .filter(([, entry]) => now - entry.windowStartedAt >= this.windowMs)
      .map(([clientIp]) => clientIp);
    expiredClientIps.forEach(clientIp => this.entries.delete(clientIp));
  }

  private evictOldestEntry() {
    const oldest = this.entries.keys().next().value;
    if (oldest) this.entries.delete(oldest);
  }
}

// Per-process protection for the only public write endpoint. On autoscaling
// deployments each instance enforces its own short window without persisting IPs.
export const appointmentSubmissionRateLimiter = new AppointmentSubmissionRateLimiter();


export const APPOINTMENT_TIME_PATTERN = /^(0[1-9]|1[0-2]):([0-5][0-9]) (AM|PM)$/;

export function parsePreferredTime(value: string): number {
  const match = APPOINTMENT_TIME_PATTERN.exec(value.trim());
  if (!match) throw new Error("Gunakan format jam XX:YY AM|PM.");
  const hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  return hour * 60 + minute + (match[3] === "PM" ? 720 : 0);
}

export function formatPreferredTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const period = normalized >= 720 ? "PM" : "AM";
  const hour = Math.floor((normalized % 720) / 60) || 12;
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

export function allocateAppointmentTime(preferredTime: string, existingAssignedTimes: string[]): string {
  let candidateMinutes = parsePreferredTime(preferredTime);
  const occupied = new Set(existingAssignedTimes.map(parsePreferredTime));
  while (occupied.has(candidateMinutes % 1440)) candidateMinutes = (candidateMinutes + 30) % 1440;
  return formatPreferredTime(candidateMinutes);
}


export type ServiceHourWindow = { start: number; end: number; byAppointment?: boolean };

const SERVICE_HOUR_RULES: Record<string, Partial<Record<number, ServiceHourWindow>>> = {
  "Poli Umum": {
    0: { start: 16 * 60, end: 21 * 60 },
    1: { start: 9 * 60, end: 21 * 60 },
    2: { start: 9 * 60, end: 21 * 60 },
    3: { start: 9 * 60, end: 21 * 60 },
    4: { start: 9 * 60, end: 21 * 60 },
    5: { start: 9 * 60, end: 21 * 60 },
    6: { start: 9 * 60, end: 21 * 60 },
  },
  "Poli Kandungan": {
    0: { start: 11 * 60, end: 21 * 60, byAppointment: true },
    1: { start: 17 * 60, end: 21 * 60, byAppointment: true },
  },
  "Poli Gigi": {
    0: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
    1: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
    2: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
    3: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
    4: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
    5: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true },
  },
  "Poli Penyakit Dalam": Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { start: 9 * 60, end: 21 * 60, byAppointment: true }])),
  "Poli Bedah": Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { start: 9 * 60, end: 21 * 60, byAppointment: true }])),
};

export function getServiceHourWindow(service: string, preferredDate: string): ServiceHourWindow | null {
  const dayOfWeek = new Date(`${preferredDate}T12:00:00+08:00`).getDay();
  return SERVICE_HOUR_RULES[service]?.[dayOfWeek] ?? null;
}

export function validatePreferredServiceTime(service: string, preferredDate: string, preferredTime: string): { valid: true; window: ServiceHourWindow | null } | { valid: false; message: string } {
  const minutes = parsePreferredTime(preferredTime);
  const window = getServiceHourWindow(service, preferredDate);
  if (!window) {
    if (SERVICE_HOUR_RULES[service]) return { valid: false, message: `${service} tidak memiliki jadwal layanan pada hari tersebut.` };
    return { valid: true, window: null };
  }
  if (minutes < window.start || minutes > window.end) {
    return { valid: false, message: `${service} melayani pada ${formatPreferredTime(window.start)}–${formatPreferredTime(window.end)} WITA${window.byAppointment ? " sesuai perjanjian" : ""}.` };
  }
  return { valid: true, window };
}
