import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { TRPCError } from "@trpc/server";
import { normalizeAssetFileName, decodeMediaUpload } from "./clinicContent";
import {
  createAppointmentRequest,
  createMediaAsset,
  createWhatsAppFollowUpActivity,
  getAdminClinicContent,
  getAppointmentRequests,
  getPublicClinicContent,
  getPublicOsdSnapshot,
  getWhatsAppFollowUpActivities,
  saveClinicProfile,
  saveService,
  saveWhatsAppSignatureTemplate,
  updateAppointmentRequestStatus,
} from "./db";
import {
  appointmentSubmissionRateLimiter,
  getClientIp,
  isAutomatedAppointmentRequest,
  normalizeAppointmentNote,
} from "./appointmentRequest";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { getTurnstileVerificationSecret, verifyTurnstileToken } from "./turnstile";
import { MAX_WHATSAPP_DRAFT_LENGTH } from "../shared/whatsappMessageMetrics";

const profileInput = z.object({
  name: z.string().min(2).max(160),
  tagline: z.string().min(2).max(255),
  address: z.string().min(8).max(2000),
  whatsappUrl: z.string().url().refine(value => /^https:\/\/wa\.me\/\d+$/.test(value), "Use an official wa.me WhatsApp link."),
  instagramUrl: z.string().url().nullable().optional(),
});

const serviceInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(2).max(160),
  summary: z.string().min(8).max(4000),
  imageUrl: z.string().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

const appointmentInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  contactNumber: z.string().trim().min(8).max(40).regex(/^[0-9+()\-\s]+$/, "Use a valid phone or WhatsApp number."),
  service: z.string().trim().min(2).max(160),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid preferred date."),
  preferredTime: z.string().regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, "Gunakan format jam XX:YY AM|PM."),
  note: z.string().trim().max(600).optional(),
  consent: z.literal(true),
  website: z.string().max(255).optional(),
  captchaToken: z.string().trim().max(2048).optional(),
});

const followUpActivityFilterInput = z.object({
  messageStatus: z.enum(["draft_copied", "whatsapp_opened"]).optional(),
  startAt: z.date().optional(),
  endAt: z.date().optional(),
}).superRefine((input, context) => {
  if (input.startAt && input.endAt && input.startAt > input.endAt) {
    context.addIssue({ code: "custom", message: "Tanggal mulai tidak boleh setelah tanggal akhir.", path: ["endAt"] });
  }
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  appointments: router({
    create: publicProcedure.input(appointmentInput).mutation(async ({ ctx, input }) => {
      if (isAutomatedAppointmentRequest(input.website)) return { success: true, requestId: null } as const;
      const clientIp = getClientIp(ctx.req);
      const limit = appointmentSubmissionRateLimiter.attempt(clientIp);
      if (!limit.allowed) {
        if (!input.captchaToken) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Terlalu banyak permintaan kunjungan. Selesaikan verifikasi keamanan untuk melanjutkan.",
          });
        }

        const verification = await verifyTurnstileToken(input.captchaToken, clientIp, getTurnstileVerificationSecret());
        if (!verification.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Verifikasi keamanan tidak berhasil. Silakan coba lagi.",
          });
        }

        // The solved token is single-use at the provider. It is intentionally
        // neither persisted nor included in the appointment request.
      }
      const request = await createAppointmentRequest({
        fullName: input.fullName,
        contactNumber: input.contactNumber,
        service: input.service,
        preferredDate: input.preferredDate,
        preferredTime: input.preferredTime,
        note: normalizeAppointmentNote(input.note),
      });
      return { success: true, requestId: request.id, queueNumber: request.queueNumber, assignedTime: request.assignedTime } as const;
    }),
    list: adminProcedure.query(() => getAppointmentRequests()),
    updateStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "contacted", "closed"]) }))
      .mutation(({ input }) => updateAppointmentRequestStatus(input.id, input.status)),
    listFollowUpActivities: adminProcedure.input(followUpActivityFilterInput.optional()).query(({ input }) => getWhatsAppFollowUpActivities(input)),
    recordFollowUpActivity: adminProcedure
      .input(z.object({
        appointmentRequestId: z.number().int().positive(),
        messageStatus: z.enum(["draft_copied", "whatsapp_opened"]),
        finalDraftLength: z.number().int().min(0).max(MAX_WHATSAPP_DRAFT_LENGTH),
      }))
      .mutation(({ ctx, input }) => createWhatsAppFollowUpActivity({ ...input, recordedBy: ctx.user.id })),
    updateSignatureTemplate: adminProcedure
      .input(z.object({ content: z.string().trim().min(2).max(1000) }))
      .mutation(({ ctx, input }) => saveWhatsAppSignatureTemplate(input.content, ctx.user.id)),
  }),
  osd: router({
    snapshot: publicProcedure.query(() => getPublicOsdSnapshot()),
  }),
  clinic: router({
    publicContent: publicProcedure.query(() => getPublicClinicContent()),
    adminContent: adminProcedure.query(() => getAdminClinicContent()),
    updateProfile: adminProcedure.input(profileInput).mutation(({ input }) => saveClinicProfile(input)),
    saveService: adminProcedure.input(serviceInput).mutation(({ input }) => saveService(input)),
    uploadMedia: adminProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(120),
        dataBase64: z.string().min(1).max(7_000_000),
        altText: z.string().min(2).max(255),
        category: z.enum(["brand", "service", "clinician", "facility", "document"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = decodeMediaUpload(input);
        const fileName = normalizeAssetFileName(input.fileName);
        const stored = await storagePut(`clinic/${ctx.user.id}/${fileName}`, buffer, input.mimeType);
        return createMediaAsset({
          storageKey: stored.key,
          publicUrl: stored.url,
          fileName,
          altText: input.altText,
          mimeType: input.mimeType,
          category: input.category,
          uploadedBy: ctx.user.id,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
