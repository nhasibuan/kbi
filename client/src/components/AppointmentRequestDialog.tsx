import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { CalendarDays, MessageCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AppointmentRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: string[];
  whatsappUrl: string;
};

const initialForm = {
  fullName: "",
  contactNumber: "",
  service: "",
  preferredDate: "",
  preferredTime: "09:00 AM",
  note: "",
  consent: false,
  website: "",
};

type TurnstileWidget = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-api";
const HOUR_MINUTE_PATTERN = /^(0[1-9]|1[0-2]):[0-5][0-9]$/;
const SERVICE_WINDOWS: Record<string, Partial<Record<number, { start: number; end: number; byAppointment?: boolean }>>> = {
  "Poli Umum": { 0: { start: 16 * 60, end: 21 * 60 }, 1: { start: 9 * 60, end: 21 * 60 }, 2: { start: 9 * 60, end: 21 * 60 }, 3: { start: 9 * 60, end: 21 * 60 }, 4: { start: 9 * 60, end: 21 * 60 }, 5: { start: 9 * 60, end: 21 * 60 }, 6: { start: 9 * 60, end: 21 * 60 } },
  "Poli Kandungan": { 0: { start: 11 * 60, end: 21 * 60, byAppointment: true }, 1: { start: 17 * 60, end: 21 * 60, byAppointment: true } },
  "Poli Gigi": { 0: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true }, 1: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true }, 2: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true }, 3: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true }, 4: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true }, 5: { start: 16 * 60 + 30, end: 21 * 60, byAppointment: true } },
  "Poli Penyakit Dalam": Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { start: 9 * 60, end: 21 * 60, byAppointment: true }])),
  "Poli Bedah": Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { start: 9 * 60, end: 21 * 60, byAppointment: true }])),
};

function toMinutes(time: string) {
  const [clock, period] = time.split(" ");
  const [hour, minute] = clock.split(":").map(Number);
  return (hour % 12) * 60 + minute + (period === "PM" ? 720 : 0);
}

function getClientServiceWindow(service: string, date: string) {
  const day = new Date(`${date}T12:00:00+08:00`).getDay();
  return SERVICE_WINDOWS[service]?.[day] ?? null;
}

function formatDisplayTime(totalMinutes: number) {
  const normalized = totalMinutes % 1440;
  const period = normalized >= 720 ? "PM" : "AM";
  const hour = Math.floor((normalized % 720) / 60) || 12;
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")} ${period}`;
}
const TURNSTILE_ALWAYS_PASS_TEST_SITE_KEY = "1x00000000000000000000AA";

function AppointmentCaptcha({ onTokenChange }: { onTokenChange: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const usesTestKey = import.meta.env.DEV && new URLSearchParams(window.location.search).get("captchaTestKey") === "1";
  const siteKey = usesTestKey ? TURNSTILE_ALWAYS_PASS_TEST_SITE_KEY : import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let disposed = false;

    const renderWidget = () => {
      if (disposed || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
        action: "appointment_request",
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
    };

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [onTokenChange, siteKey]);

  if (!siteKey) {
    return <p className="text-sm leading-6 text-rose-700">Verifikasi keamanan sedang tidak tersedia. Gunakan WhatsApp sebagai alternatif atau coba kembali nanti.</p>;
  }

  return <div ref={containerRef} aria-label="Verifikasi keamanan" />;
}

export default function AppointmentRequestDialog({ open, onOpenChange, services, whatsappUrl }: AppointmentRequestDialogProps) {
  const isDevelopmentFallbackQa = import.meta.env.DEV && new URLSearchParams(window.location.search).get("captchaQaE2E") === "1";
  const [form, setForm] = useState(initialForm);
  const [preferredTimeInput, setPreferredTimeInput] = useState("09:00");
  const [preferredPeriod, setPreferredPeriod] = useState<"AM" | "PM">("AM");
  const [requiresCaptcha, setRequiresCaptcha] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).get("captchaFallback") === "1");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [confirmation, setConfirmation] = useState<{ queueNumber: number; assignedTime: string } | null>(null);
  const captchaPanelRef = useRef<HTMLDivElement>(null);
  const fallbackQaHasRunRef = useRef(false);
  const createRequest = trpc.appointments.create.useMutation({
    onSuccess: result => {
      setForm(initialForm);
      setPreferredTimeInput("09:00");
      setPreferredPeriod("AM");
      if (result.queueNumber !== undefined && result.assignedTime !== undefined) {
        setConfirmation({ queueNumber: result.queueNumber, assignedTime: result.assignedTime });
      }
      setRequiresCaptcha(false);
      setCaptchaToken("");
      if (isDevelopmentFallbackQa) return;
      toast.success("Permintaan kunjungan sudah dikirim.", {
        description: "Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan.",
      });
    },
    onError: error => {
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        setRequiresCaptcha(true);
        setCaptchaToken("");
        setCaptchaVersion(current => current + 1);
        toast.info("Selesaikan verifikasi keamanan untuk mengirim permintaan berikutnya.");
        return;
      }
      if (requiresCaptcha) {
        setCaptchaToken("");
        setCaptchaVersion(current => current + 1);
      }
      toast.error(error.message);
    },
  });

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);

  useEffect(() => {
    if (!open || !isDevelopmentFallbackQa || fallbackQaHasRunRef.current) return;
    fallbackQaHasRunRef.current = true;
    const qaRequest = {
      fullName: "QA CAPTCHA Browser Fallback",
      contactNumber: "+6285215862526",
      service: "Poli Umum",
      preferredDate: "2026-08-26",
      preferredTime: "09:00 AM",
      consent: true as const,
      note: "",
      website: "",
    };
    setForm(qaRequest);
    void (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await createRequest.mutateAsync(qaRequest);
        } catch {
          // The fourth real endpoint response activates the ordinary fallback handler above.
        }
      }
    })();
  }, [createRequest, isDevelopmentFallbackQa, open]);

  useEffect(() => {
    const shouldScrollToCaptcha = import.meta.env.DEV && new URLSearchParams(window.location.search).get("captchaQaScroll") === "1";
    if (!requiresCaptcha || !shouldScrollToCaptcha) return;
    const frame = window.requestAnimationFrame(() => captchaPanelRef.current?.scrollIntoView({ block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [requiresCaptcha]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!HOUR_MINUTE_PATTERN.test(preferredTimeInput)) {
      toast.error("Jam pilihan harus menggunakan format XX:YY, contoh 09:30.");
      return;
    }
    const combinedTime = `${preferredTimeInput} ${preferredPeriod}`;
    const window = getClientServiceWindow(form.service, form.preferredDate);
    if (window && (toMinutes(combinedTime) < window.start || toMinutes(combinedTime) > window.end)) {
      toast.error(`Jam layanan ${form.service} adalah ${formatDisplayTime(window.start)}–${formatDisplayTime(window.end)} WITA${window.byAppointment ? " sesuai perjanjian" : ""}.`);
      return;
    }
    if (SERVICE_WINDOWS[form.service] && !window) {
      toast.error(`${form.service} tidak memiliki jadwal layanan pada hari tersebut.`);
      return;
    }
    createRequest.mutate({ ...form, preferredTime: `${preferredTimeInput} ${preferredPeriod}`, consent: true, captchaToken: requiresCaptcha ? captchaToken || undefined : undefined });
  };

  const today = new Date().toISOString().slice(0, 10);
  const selectedWindow = getClientServiceWindow(form.service, form.preferredDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-[#fbfaf5] p-0 sm:max-w-[680px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#039CB7] text-white"><CalendarDays size={19} /></div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">Ajukan kunjungan</DialogTitle>
            <DialogDescription className="max-w-xl text-sm leading-6 text-white/75">Isi formulir di bawah untuk memilih layanan dan tanggal pilihan Anda. Form tersebut bukan konfirmasi janji maupun layanan gawat darurat.</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          {confirmation ? <div className="rounded-2xl border border-[#039CB7]/25 bg-[#eef8f8] p-5" role="status">
            <p className="text-sm font-bold uppercase tracking-[.12em] text-[#007f98]">Permintaan diterima</p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-[#173047]">Nomor antrian Anda: {confirmation.queueNumber}</h3>
            <p className="mt-2 text-sm leading-6 text-[#395568]">Jam layanan yang dialokasikan sistem: <strong>{confirmation.assignedTime}</strong>. Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan.</p>
            <button type="button" onClick={() => { setConfirmation(null); onOpenChange(false); }} className="mt-5 inline-flex rounded-full bg-[#039CB7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#007f98]">Selesai</button>
          </div> : <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 rounded-xl border border-dashed border-[#039CB7]/40 bg-[#f5fafb] px-4 py-3 text-sm text-[#395568] sm:col-span-2">
              <span className="font-bold">Nomor antrian</span>
              <span className="text-xs leading-5 text-[#607684]">Diisi otomatis oleh sistem setelah permintaan berhasil dikirim.</span>
            </div>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Nama lengkap
              <input required value={form.fullName} onChange={e => setForm(current => ({ ...current, fullName: e.target.value }))} autoComplete="name" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Nomor WhatsApp / telepon
              <input required type="tel" value={form.contactNumber} onChange={e => setForm(current => ({ ...current, contactNumber: e.target.value }))} autoComplete="tel" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Layanan yang ingin ditanyakan
              <select required value={form.service} onChange={e => setForm(current => ({ ...current, service: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10">
                <option value="" disabled>Pilih layanan</option>
                {services.map(service => <option key={service} value={service}>{service}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Tanggal pilihan
              <input required type="date" min={today} value={form.preferredDate} onChange={e => setForm(current => ({ ...current, preferredDate: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Jam pilihan
              <div className="flex gap-2">
                <input required type="text" inputMode="numeric" pattern="(0[1-9]|1[0-2]):[0-5][0-9]" maxLength={5} placeholder="09:30" value={preferredTimeInput} onChange={event => setPreferredTimeInput(event.target.value.replace(/[^0-9:]/g, "").slice(0, 5))} aria-describedby="preferred-time-help" className="min-w-0 flex-1 rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
                <select required value={preferredPeriod} onChange={event => setPreferredPeriod(event.target.value as "AM" | "PM")} aria-label="Periode jam pilihan" className="w-24 rounded-xl border border-[#173047]/15 bg-white px-3 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"><option value="AM">AM</option><option value="PM">PM</option></select>
              </div>
              <span id="preferred-time-help" className="text-xs font-normal text-[#607684]">Masukkan jam dan menit dengan format XX:YY, lalu pilih AM atau PM.</span>
              {selectedWindow ? <span className="text-xs font-semibold text-[#007f98]">Jam layanan poli ini: {formatDisplayTime(selectedWindow.start)}–{formatDisplayTime(selectedWindow.end)} WITA{selectedWindow.byAppointment ? " (sesuai perjanjian)" : ""}.</span> : form.service && SERVICE_WINDOWS[form.service] && form.preferredDate ? <span className="text-xs font-semibold text-amber-700">Poli ini tidak memiliki jadwal pada tanggal yang dipilih.</span> : null}
            </label>
          </div>}

          {!confirmation && <label className="grid gap-2 text-sm font-bold text-[#395568]">Catatan untuk penjadwalan <span className="font-normal text-[#607684]">(opsional)</span>
            <textarea value={form.note} onChange={e => setForm(current => ({ ...current, note: e.target.value }))} maxLength={600} rows={3} placeholder="Contoh: lebih mudah dihubungi pada sore hari. Jangan sertakan diagnosis atau hasil pemeriksaan." className="resize-none rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
          </label>}

          {!confirmation && <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm(current => ({ ...current, website: e.target.value }))} /></label>
          </div>}

          {!confirmation && <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#eef8f8] p-4 text-sm leading-6 text-[#395568]">
            <input required type="checkbox" checked={form.consent} onChange={e => setForm(current => ({ ...current, consent: e.target.checked }))} className="mt-1 h-4 w-4 accent-[#039CB7]" />
            <span>Saya setuju Klinik Berkat Insani menggunakan data di atas untuk menanggapi pengajuan kunjungan. Saya memahami bahwa pengajuan tersebut bukan konfirmasi jadwal.</span>
          </label>}

          {!confirmation && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><ShieldCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />Untuk keadaan darurat, hubungi layanan darurat setempat atau fasilitas kesehatan terdekat. Jangan gunakan formulir untuk kondisi yang membutuhkan pertolongan segera.          </div>}

          {!confirmation && requiresCaptcha && <div ref={captchaPanelRef} className="rounded-2xl border border-[#039CB7]/25 bg-[#eef8f8] p-4" role="status">
            <p className="mb-3 text-sm font-bold text-[#173047]">Verifikasi keamanan diperlukan</p>
            <p className="mb-4 text-sm leading-6 text-[#395568]">Untuk melindungi formulir dari pengiriman berulang, selesaikan verifikasi singkat ini. Token verifikasi tidak disimpan bersama permintaan kunjungan.</p>
            <AppointmentCaptcha key={captchaVersion} onTokenChange={handleCaptchaToken} />
          </div>}

          {!confirmation && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[#007f98] transition hover:text-[#039CB7]"><MessageCircle size={16} /> Gunakan WhatsApp sebagai alternatif</a>
            <button type="submit" disabled={createRequest.isPending || !form.consent || !HOUR_MINUTE_PATTERN.test(preferredTimeInput) || (requiresCaptcha && !captchaToken)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#039CB7] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:cursor-not-allowed disabled:opacity-60">{createRequest.isPending ? "Mengirim..." : "Kirim permintaan"}</button>
          </div>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
