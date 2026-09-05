import { and, asc, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointmentRequests,
  clinicProfiles,
  InsertUser,
  mediaAssets,
  services,
  users,
  whatsappFollowUpActivities,
  whatsappSignatureTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { allocateAppointmentTime } from "./appointmentRequest";
import { OSD_DOCTORS } from "../shared/osd";

let _db: ReturnType<typeof drizzle> | null = null;

export type ClinicProfileInput = {
  name: string;
  tagline: string;
  address: string;
  whatsappUrl: string;
  instagramUrl?: string | null;
};

export type ServiceInput = {
  id?: number;
  name: string;
  summary: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

export type AppointmentRequestInput = {
  fullName: string;
  contactNumber: string;
  service: string;
  preferredDate: string;
  preferredTime: string;
  note?: string | null;
};

export type WhatsAppFollowUpActivityInput = {
  appointmentRequestId: number;
  messageStatus: "draft_copied" | "whatsapp_opened";
  finalDraftLength: number;
  recordedBy: number;
};

export type WhatsAppFollowUpActivityFilters = {
  messageStatus?: "draft_copied" | "whatsapp_opened";
  startAt?: Date;
  endAt?: Date;
};

export function resolveUserRole(
  incomingRole: InsertUser["role"],
  existingRole: "admin" | "user" | undefined,
  openId: string,
  ownerOpenId: string | undefined,
): "admin" | "user" {
  return incomingRole ?? existingRole ?? (openId === ownerOpenId ? "admin" : "user");
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const role = resolveUserRole(user.role, existing?.role, user.openId, ENV.ownerOpenId);
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date(), role };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn, role };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getPublicClinicContent() {
  const db = await getDb();
  if (!db) return { profile: null, services: [] };
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  const publicServices = await db
    .select()
    .from(services)
    .where(eq(services.isPublished, true))
    .orderBy(asc(services.sortOrder));
  return { profile: profile ?? null, services: publicServices };
}

export async function getAdminClinicContent() {
  const db = requireDb(await getDb());
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  const allServices = await db.select().from(services).orderBy(asc(services.sortOrder));
  const assets = await db.select().from(mediaAssets).orderBy(asc(mediaAssets.uploadedAt));
  const [signatureTemplate] = await db.select().from(whatsappSignatureTemplates).limit(1);
  return { profile: profile ?? null, services: allServices, mediaAssets: assets, signatureTemplate: signatureTemplate ?? null };
}

export async function saveClinicProfile(input: ClinicProfileInput) {
  const db = requireDb(await getDb());
  const [existing] = await db.select({ id: clinicProfiles.id }).from(clinicProfiles).limit(1);
  if (existing) {
    await db.update(clinicProfiles).set(input).where(eq(clinicProfiles.id, existing.id));
  } else {
    await db.insert(clinicProfiles).values({ ...input, instagramUrl: input.instagramUrl ?? null });
  }
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  return profile!;
}

export async function saveService(input: ServiceInput) {
  const db = requireDb(await getDb());
  const values = {
    name: input.name,
    summary: input.summary,
    imageUrl: input.imageUrl,
    sortOrder: input.sortOrder,
    isPublished: input.isPublished,
  };
  if (input.id) {
    await db.update(services).set(values).where(eq(services.id, input.id));
  } else {
    await db.insert(services).values(values);
  }
  const result = await db.select().from(services).orderBy(asc(services.sortOrder));
  return result;
}

export async function createMediaAsset(input: {
  storageKey: string;
  publicUrl: string;
  fileName: string;
  altText: string;
  mimeType: string;
  category: "brand" | "service" | "clinician" | "facility" | "document";
  uploadedBy: number;
}) {
  const db = requireDb(await getDb());
  await db.insert(mediaAssets).values(input);
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, input.storageKey)).limit(1);
  return asset!;
}

export async function createAppointmentRequest(input: AppointmentRequestInput) {
  const db = requireDb(await getDb());
  const lockName = `kbi-appointment-${input.preferredDate}`;

  return db.transaction(async tx => {
    const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockName}, 10) AS acquired`);
    const acquired = Number((lockResult as any)[0]?.acquired ?? (lockResult as any)[0]?.[0]?.acquired ?? 0);
    if (acquired !== 1) throw new Error("Sistem penjadwalan sedang sibuk. Silakan coba lagi.");

    try {
      const existing = await tx
        .select({ assignedTime: appointmentRequests.assignedTime })
        .from(appointmentRequests)
        .where(eq(appointmentRequests.preferredDate, input.preferredDate));
      const queueRows = await tx
        .select({ id: appointmentRequests.id })
        .from(appointmentRequests)
        .where(eq(appointmentRequests.preferredDate, input.preferredDate));
      const assignedTime = allocateAppointmentTime(input.preferredTime, existing.map(row => row.assignedTime));
      const queueNumber = queueRows.length + 1;
      const inserted = await tx.insert(appointmentRequests).values({
        ...input,
        assignedTime,
        queueNumber,
        note: input.note ?? null,
        consentedAt: new Date(),
      });
      return { id: Number(inserted[0].insertId), preferredTime: input.preferredTime, assignedTime, queueNumber };
    } finally {
      await tx.execute(sql`SELECT RELEASE_LOCK(${lockName})`);
    }
  });
}

export async function getAppointmentRequests() {
  const db = requireDb(await getDb());
  return db.select().from(appointmentRequests).orderBy(desc(appointmentRequests.createdAt));
}

export function getWitaDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

type OsdQueueRow = {
  queueNumber: number;
  fullName: string;
  service: string;
  assignedTime: string;
  status: "new" | "contacted" | "closed";
};

export function buildOsdSnapshot(rows: OsdQueueRow[], today: string, lastUpdated = new Date().toISOString()) {
  const displayRows = rows.filter(row => row.status !== "closed").map(row => ({ ...row, doctor: OSD_DOCTORS[row.service] ?? "Staf medis klinik" }));
  const waiting = displayRows.filter(row => row.status === "new");
  const inTreatment = displayRows.filter(row => row.status === "contacted");
  return { today, active: waiting[0] ?? inTreatment[0] ?? null, waiting, inTreatment, lastUpdated };
}

export async function getPublicOsdSnapshot() {
  const db = await getDb();
  const today = getWitaDateString();
  if (!db) return buildOsdSnapshot([], today);
  const rows = await db
    .select({ queueNumber: appointmentRequests.queueNumber, fullName: appointmentRequests.fullName, service: appointmentRequests.service, assignedTime: appointmentRequests.assignedTime, status: appointmentRequests.status })
    .from(appointmentRequests)
    .where(and(eq(appointmentRequests.preferredDate, today), ne(appointmentRequests.status, "closed")))
    .orderBy(asc(appointmentRequests.queueNumber));
  return buildOsdSnapshot(rows, today);
}

export async function updateAppointmentRequestStatus(id: number, status: "new" | "contacted" | "closed") {
  const db = requireDb(await getDb());
  await db.update(appointmentRequests).set({ status }).where(eq(appointmentRequests.id, id));
  const [request] = await db.select().from(appointmentRequests).where(eq(appointmentRequests.id, id)).limit(1);
  return request;
}

export async function createWhatsAppFollowUpActivity(input: WhatsAppFollowUpActivityInput) {
  const db = requireDb(await getDb());
  const [request] = await db.select({ id: appointmentRequests.id }).from(appointmentRequests).where(eq(appointmentRequests.id, input.appointmentRequestId)).limit(1);
  if (!request) throw new Error("Permintaan kunjungan tidak ditemukan.");
  const inserted = await db.insert(whatsappFollowUpActivities).values(input);
  const [activity] = await db.select().from(whatsappFollowUpActivities).where(eq(whatsappFollowUpActivities.id, Number(inserted[0].insertId))).limit(1);
  return activity!;
}

export async function getWhatsAppFollowUpActivities(filters: WhatsAppFollowUpActivityFilters = {}) {
  const db = requireDb(await getDb());
  const conditions: SQL[] = [];
  if (filters.messageStatus) conditions.push(eq(whatsappFollowUpActivities.messageStatus, filters.messageStatus));
  if (filters.startAt) conditions.push(gte(whatsappFollowUpActivities.createdAt, filters.startAt));
  if (filters.endAt) conditions.push(lte(whatsappFollowUpActivities.createdAt, filters.endAt));

  const query = db.select().from(whatsappFollowUpActivities);
  return conditions.length
    ? query.where(and(...conditions)).orderBy(desc(whatsappFollowUpActivities.createdAt))
    : query.orderBy(desc(whatsappFollowUpActivities.createdAt));
}

export async function saveWhatsAppSignatureTemplate(content: string, updatedBy: number) {
  const db = requireDb(await getDb());
  const [existing] = await db.select({ id: whatsappSignatureTemplates.id }).from(whatsappSignatureTemplates).limit(1);
  if (existing) {
    await db.update(whatsappSignatureTemplates).set({ content, updatedBy }).where(eq(whatsappSignatureTemplates.id, existing.id));
  } else {
    await db.insert(whatsappSignatureTemplates).values({ content, updatedBy });
  }
  const [template] = await db.select().from(whatsappSignatureTemplates).limit(1);
  return template!;
}
