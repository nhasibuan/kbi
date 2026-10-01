import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { CalendarDays, MessageCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type AppointmentRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: string[];
  whatsappUrl: string;
};

const initialForm = {
  fullName: "",
  nik: "",
  birthPlace: "",
  birthDate: "",
  address: "",
  religion: "",
  contactNumber: "",
  service: "",
  preferredDate: "",
  preferredTime: "09:00 AM",
  complaint: "",
  consent: false,
  website: "",
};

type ConfirmationDetails = {
  queueNumber: number;
  assignedTime: string;
  preferredDate: string;
  fullName: string;
  contactNumber: string;
  service: string;
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
  const [confirmation, setConfirmation] = useState<ConfirmationDetails | null>(null);
  const captchaPanelRef = useRef<HTMLDivElement>(null);
  const fallbackQaHasRunRef = useRef(false);
  const previewInput = useMemo(() => ({ preferredDate: form.preferredDate }), [form.preferredDate]);
  const { data: queuePreview, isLoading: queuePreviewLoading, isError: queuePreviewError } = trpc.appointments.queuePreview.useQuery(previewInput, {
    enabled: open && Boolean(form.preferredDate),
  });
  const createRequest = trpc.appointments.create.useMutation({
    onSuccess: result => {
      const submittedForm = form;
      setForm(initialForm);
      setPreferredTimeInput("09:00");
      setPreferredPeriod("AM");
      if (result.queueNumber !== undefined && result.assignedTime !== undefined) {
        setConfirmation({
          queueNumber: result.queueNumber,
          assignedTime: result.assignedTime,
          preferredDate: submittedForm.preferredDate,
          fullName: submittedForm.fullName,
          contactNumber: submittedForm.contactNumber,
          service: submittedForm.service,
        });
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

  const saveConfirmationImage = () => {
    if (!confirmation) return;
    const lines = [
      "KLINIK BERKAT INSANI",
      "Ringkasan pengajuan kunjungan",
      `Nomor antrian: ${confirmation.queueNumber}`,
      `Tanggal pilihan: ${confirmation.preferredDate}`,
      `Nama lengkap: ${confirmation.fullName}`,
      `Nomor WhatsApp: ${confirmation.contactNumber}`,
      `Layanan poli: ${confirmation.service}`,
      `Jam layanan: ${confirmation.assignedTime}`,
    ];
    const escaped = lines.map(line => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620"><rect width="900" height="620" rx="32" fill="#eef8f8"/><rect x="32" y="32" width="836" height="556" rx="24" fill="#ffffff"/><rect x="32" y="32" width="836" height="112" rx="24" fill="#173047"/><text x="72" y="82" fill="#ffffff" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escaped[0]}</text><text x="72" y="118" fill="#bfeaf0" font-family="Arial, sans-serif" font-size="18">${escaped[1]}</text>${escaped.slice(2).map((line, index) => `<text x="80" y="${210 + index * 52}" fill="#173047" font-family="Arial, sans-serif" font-size="23"${index === 0 ? " font-weight=\"700\"" : ""}>${line}</text>`).join("")}<text x="80" y="555" fill="#607684" font-family="Arial, sans-serif" font-size="16">Harap tunggu konfirmasi dari staf klinik.</text></svg>`;
    const link = document.createElement("a");
    link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    link.download = `ringkasan-kunjungan-${confirmation.queueNumber}.svg`;
    link.click();
    toast.success("Ringkasan berhasil disimpan sebagai gambar.");
  };

  const sendConfirmationToWhatsApp = () => {
    if (!confirmation) return;
    const message = [
      "Halo Klinik Berkat Insani, saya ingin mengirim ringkasan pengajuan kunjungan:",
      `Nomor antrian: ${confirmation.queueNumber}`,
      `Tanggal pilihan: ${confirmation.preferredDate}`,
      `Nama lengkap: ${confirmation.fullName}`,
      `Nomor WhatsApp: ${confirmation.contactNumber}`,
      `Layanan poli: ${confirmation.service}`,
      `Jam layanan: ${confirmation.assignedTime}`,
      "Mohon bantu konfirmasi ketersediaannya. Terima kasih.",
    ].join("\n");
    const separator = whatsappUrl.includes("?") ? "&" : "?";
    window.open(`${whatsappUrl}${separator}text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const finishConfirmation = () => {
    saveConfirmationImage();
    sendConfirmationToWhatsApp();
    setConfirmation(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open || !isDevelopmentFallbackQa || fallbackQaHasRunRef.current) return;
    fallbackQaHasRunRef.current = true;
    const qaRequest = {
      fullName: "QA CAPTCHA Browser Fallback",
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
            <div id="appointment-confirmation-object" className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-display text-2xl font-semibold text-[#173047]">Ringkasan pengajuan kunjungan</h3>
              <dl className="mt-4 grid gap-3 text-sm text-[#395568]">
                <div className="flex items-start justify-between gap-4 border-b border-[#173047]/10 pb-3"><dt>Nomor antrian</dt><dd className="font-bold text-[#007f98]">{confirmation.queueNumber}</dd></div>
                <div className="flex items-start justify-between gap-4 border-b border-[#173047]/10 pb-3"><dt>Tanggal pilihan</dt><dd className="text-right font-semibold">{new Date(`${confirmation.preferredDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
                <div className="flex items-start justify-between gap-4 border-b border-[#173047]/10 pb-3"><dt>Nama lengkap</dt><dd className="text-right font-semibold">{confirmation.fullName}</dd></div>
                <div className="flex items-start justify-between gap-4 border-b border-[#173047]/10 pb-3"><dt>Nomor WhatsApp</dt><dd className="text-right font-semibold">{confirmation.contactNumber}</dd></div>
                <div className="flex items-start justify-between gap-4 border-b border-[#173047]/10 pb-3"><dt>Layanan poli</dt><dd className="text-right font-semibold">{confirmation.service}</dd></div>
                <div className="flex items-start justify-between gap-4"><dt>Jam layanan</dt><dd className="text-right font-bold text-[#007f98]">{confirmation.assignedTime}</dd></div>
              </dl>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#395568]">Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={finishConfirmation} className="inline-flex items-center justify-center rounded-full bg-[#039CB7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#007f98]">Selesai</button>
            </div>
          </div> : <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 rounded-xl border border-dashed border-[#039CB7]/40 bg-[#f5fafb] px-4 py-3 text-sm text-[#395568] sm:col-span-2">
              <span className="font-bold">Nomor antrian</span>
              <span className="text-2xl font-semibold text-[#007f98]" aria-label="Nomor antrian sementara">{queuePreviewLoading ? "…" : queuePreviewError ? "—" : queuePreview ?? "—"}</span>
              <span className="text-xs leading-5 text-[#607684]">Nomor antrean sementara untuk tanggal pilihan. Nomor ini belum dipesan dan dapat berubah jika ada pengajuan lebih dulu.</span>
            </div>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Nama lengkap
              <input required value={form.fullName} onChange={e => setForm(current => ({ ...current, fullName: e.target.value }))} autoComplete="name" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">NIK
              <input required type="text" inputMode="numeric" pattern="[0-9]{16}" maxLength={16} value={form.nik} onChange={e => setForm(current => ({ ...current, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))} autoComplete="off" aria-describedby="nik-help" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
              <span id="nik-help" className="text-xs font-normal text-[#607684]">16 digit angka. Data ini hanya terlihat oleh administrator.</span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Tempat lahir
              <input required value={form.birthPlace} onChange={e => setForm(current => ({ ...current, birthPlace: e.target.value }))} autoComplete="address-level2" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Tanggal lahir
              <input required type="date" value={form.birthDate} onChange={e => setForm(current => ({ ...current, birthDate: e.target.value }))} autoComplete="bday" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Agama
              <select required value={form.religion} onChange={e => setForm(current => ({ ...current, religion: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10">
                <option value="" disabled>Pilih agama</option><option value="Islam">Islam</option><option value="Kristen Protestan">Kristen Protestan</option><option value="Katolik">Katolik</option><option value="Hindu">Hindu</option><option value="Buddha">Buddha</option><option value="Konghucu">Konghucu</option><option value="Lainnya">Lainnya</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568] sm:col-span-2">Alamat lengkap
              <textarea required value={form.address} onChange={e => setForm(current => ({ ...current, address: e.target.value }))} autoComplete="street-address" rows={3} className="resize-none rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
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

          {!confirmation && <label className="grid gap-2 text-sm font-bold text-[#395568]">Keluhan
            <textarea required value={form.complaint} onChange={e => setForm(current => ({ ...current, complaint: e.target.value }))} maxLength={600} rows={3} placeholder="Ceritakan keluhan anda." aria-describedby="complaint-help" className="resize-none rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            <span id="complaint-help" className="text-xs font-normal leading-5 text-[#607684]">Keluhan ini hanya untuk membantu staf menindaklanjuti pengajuan dan tidak digunakan untuk diagnosis otomatis.</span>
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
