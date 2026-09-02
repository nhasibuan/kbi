import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import WhatsAppFollowUpDialog from "@/components/WhatsAppFollowUpDialog";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ExternalLink, History, Loader2, MessageCircle, Plus, RotateCcw, Save, SlidersHorizontal, UploadCloud } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProfileForm = {
  name: string;
  tagline: string;
  address: string;
  whatsappUrl: string;
  instagramUrl: string;
};

const emptyProfile: ProfileForm = {
  name: "Klinik Berkat Insani",
  tagline: "Melayani dengan kasih",
  address: "Jl. Ahmad Yani KM. 296, Tegal Rejo, Kelumpang Hilir, Kotabaru, Kalimantan Selatan 72161",
  whatsappUrl: "https://wa.me/6285215862526",
  instagramUrl: "https://www.instagram.com/klinikberkatinsani/",
};

const defaultSignature = "Salam hangat,\nTim Klinik Berkat Insani\nKelumpang Hilir, Kotabaru";

type FollowUpActivityStatusFilter = "all" | "draft_copied" | "whatsapp_opened";

function getInitialActivityStatusFilter(): FollowUpActivityStatusFilter {
  const value = new URLSearchParams(window.location.search).get("activityStatus");
  return value === "draft_copied" || value === "whatsapp_opened" ? value : "all";
}

export default function ClinicAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clinic.adminContent.useQuery(undefined, { enabled: isAdmin });
  const { data: appointmentRequests, isLoading: appointmentRequestsLoading } = trpc.appointments.list.useQuery(undefined, { enabled: isAdmin });
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [service, setService] = useState({ name: "", summary: "", imageUrl: "" });
  const [assetAlt, setAssetAlt] = useState("");
  const [assetCategory, setAssetCategory] = useState<"brand" | "service" | "clinician" | "facility" | "document">("service");
  const [followUpRequest, setFollowUpRequest] = useState<{ id: number; fullName: string; contactNumber: string; service: string; preferredDate: string } | null>(null);
  const [signatureTemplate, setSignatureTemplate] = useState(defaultSignature);
  const [activityStatusFilter, setActivityStatusFilter] = useState<FollowUpActivityStatusFilter>(getInitialActivityStatusFilter);
  const [activityStartDate, setActivityStartDate] = useState(() => new URLSearchParams(window.location.search).get("activityStart") ?? "");
  const [activityEndDate, setActivityEndDate] = useState(() => new URLSearchParams(window.location.search).get("activityEnd") ?? "");

  const activityDateRangeInvalid = Boolean(activityStartDate && activityEndDate && activityStartDate > activityEndDate);
  const activityHistoryQueryInput = useMemo(() => ({
    messageStatus: activityStatusFilter === "all" ? undefined : activityStatusFilter,
    startAt: activityStartDate ? new Date(`${activityStartDate}T00:00:00`) : undefined,
    endAt: activityEndDate ? new Date(`${activityEndDate}T23:59:59.999`) : undefined,
  }), [activityEndDate, activityStartDate, activityStatusFilter]);
  const { data: followUpActivities, isLoading: followUpActivitiesLoading } = trpc.appointments.listFollowUpActivities.useQuery(
    activityHistoryQueryInput,
    { enabled: isAdmin && !activityDateRangeInvalid },
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activityStatusFilter === "all") params.delete("activityStatus");
    else params.set("activityStatus", activityStatusFilter);
    if (activityStartDate) params.set("activityStart", activityStartDate);
    else params.delete("activityStart");
    if (activityEndDate) params.set("activityEnd", activityEndDate);
    else params.delete("activityEnd");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [activityEndDate, activityStartDate, activityStatusFilter]);

  useEffect(() => {
    if (data?.profile) {
      setProfile({
        name: data.profile.name,
        tagline: data.profile.tagline,
        address: data.profile.address,
        whatsappUrl: data.profile.whatsappUrl,
        instagramUrl: data.profile.instagramUrl ?? "",
      });
    }
  }, [data?.profile]);

  useEffect(() => {
    if (data?.signatureTemplate?.content) setSignatureTemplate(data.signatureTemplate.content);
  }, [data?.signatureTemplate?.content]);

  useEffect(() => {
    const followUpId = Number(new URLSearchParams(window.location.search).get("followup"));
    if (!followUpId || !appointmentRequests?.length) return;
    const request = appointmentRequests.find(item => item.id === followUpId);
    if (request) {
      setFollowUpRequest({
        id: request.id,
        fullName: request.fullName,
        contactNumber: request.contactNumber,
        service: request.service,
        preferredDate: request.preferredDate,
      });
    }
  }, [appointmentRequests]);

  const updateProfile = trpc.clinic.updateProfile.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.clinic.adminContent.invalidate(), utils.clinic.publicContent.invalidate()]);
      toast.success("Profil klinik tersimpan.");
    },
    onError: error => toast.error(error.message),
  });

  const saveService = trpc.clinic.saveService.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.clinic.adminContent.invalidate(), utils.clinic.publicContent.invalidate()]);
      setService({ name: "", summary: "", imageUrl: "" });
      toast.success("Layanan tersimpan.");
    },
    onError: error => toast.error(error.message),
  });

  const uploadMedia = trpc.clinic.uploadMedia.useMutation({
    onSuccess: async () => {
      await utils.clinic.adminContent.invalidate();
      setAssetAlt("");
      toast.success("File disimpan ke managed storage.");
    },
    onError: error => toast.error(error.message),
  });

  const updateAppointmentStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.appointments.list.invalidate();
      toast.success("Status permintaan diperbarui.");
    },
    onError: error => toast.error(error.message),
  });

  const updateSignatureTemplate = trpc.appointments.updateSignatureTemplate.useMutation({
    onSuccess: async () => {
      await utils.clinic.adminContent.invalidate();
      toast.success("Template tanda tangan tersimpan.");
    },
    onError: error => toast.error(error.message),
  });

  const recordFollowUpActivity = trpc.appointments.recordFollowUpActivity.useMutation({
    onSuccess: async () => {
      await utils.appointments.listFollowUpActivities.invalidate();
    },
    onError: error => toast.error(`Aktivitas tindak lanjut tidak tersimpan: ${error.message}`),
  });

  const followUpActivitySummary = followUpActivities?.reduce(
    (summary, activity) => ({
      count: summary.count + 1,
      totalLength: summary.totalLength + activity.finalDraftLength,
    }),
    { count: 0, totalLength: 0 },
  );
  const averageFollowUpDraftLength = followUpActivitySummary?.count
    ? Math.round(followUpActivitySummary.totalLength / followUpActivitySummary.count)
    : 0;
  const hasActivityFilters = activityStatusFilter !== "all" || Boolean(activityStartDate) || Boolean(activityEndDate);
  const resetActivityFilters = () => {
    setActivityStatusFilter("all");
    setActivityStartDate("");
    setActivityEndDate("");
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!assetAlt.trim()) {
      toast.error("Tambahkan teks alternatif sebelum mengunggah file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimum adalah 5 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result.split(",")[1] : undefined;
      if (!value) {
        toast.error("File tidak dapat diproses.");
        return;
      }
      uploadMedia.mutate({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64: value,
        altText: assetAlt.trim(),
        category: assetCategory,
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-[#039CB7]" /></div>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 pb-12 text-[#173047]">
        <header className="flex flex-wrap items-end justify-between gap-5 rounded-[28px] bg-[#173047] px-7 py-8 text-white shadow-[0_18px_44px_rgba(23,48,71,.18)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#84e2ec]">Klinik Berkat Insani</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.04em]">Ruang kelola konten</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Perbarui informasi publik dan simpan aset media ke storage terkelola. Perubahan layanan yang dipublikasikan akan tampil di halaman utama.</p>
          </div>
          <a href="/" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2.5 text-sm font-bold transition hover:bg-white hover:text-[#173047]">Lihat situs publik <ExternalLink size={15} /></a>
        </header>

        {!isAdmin ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7 text-amber-900">
            <h2 className="font-display text-2xl font-semibold">Akses administrator diperlukan</h2>
            <p className="mt-2 text-sm leading-6">Masuk dengan akun pemilik proyek untuk mengelola data klinik dan file tersimpan.</p>
          </div>
        ) : isLoading ? (
          <div className="grid min-h-64 place-items-center rounded-3xl border border-[#173047]/10 bg-white"><Loader2 className="animate-spin text-[#039CB7]" /></div>
        ) : (
          <>
            <section className="rounded-[28px] border border-[#173047]/10 bg-white p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow">Identitas publik</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Profil klinik yang tersimpan</h2></div>
                <span className="rounded-full bg-[#eaf9fb] px-3 py-1.5 text-xs font-bold text-[#007f98]">Database</span>
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                {(["name", "tagline", "whatsappUrl", "instagramUrl"] as const).map(field => (
                  <label key={field} className="grid gap-2 text-sm font-bold text-[#395568]">
                    {field === "name" ? "Nama klinik" : field === "tagline" ? "Tagline" : field === "whatsappUrl" ? "URL WhatsApp" : "URL Instagram"}
                    <input value={profile[field]} onChange={e => setProfile(current => ({ ...current, [field]: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
                  </label>
                ))}
                <label className="grid gap-2 text-sm font-bold text-[#395568] md:col-span-2">Alamat publik<textarea value={profile.address} onChange={e => setProfile(current => ({ ...current, address: e.target.value }))} rows={3} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" /></label>
              </div>
              <button onClick={() => updateProfile.mutate({ ...profile, instagramUrl: profile.instagramUrl || null })} disabled={updateProfile.isPending} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#039CB7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:opacity-60"><Save size={16} /> {updateProfile.isPending ? "Menyimpan..." : "Simpan profil"}</button>
            </section>

            <section className="rounded-[28px] border border-[#173047]/10 bg-[#eef8f8] p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Tanda tangan WhatsApp</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Template profesional untuk tindak lanjut</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#607684]">Template ini ditambahkan ke draf WhatsApp dan tetap dapat disunting per pesan. Jangan masukkan catatan pasien atau informasi medis.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#007f98]">Administrator</span></div>
              <textarea value={signatureTemplate} onChange={event => setSignatureTemplate(event.target.value)} maxLength={1000} rows={4} className="mt-6 w-full resize-y rounded-2xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
              <button onClick={() => updateSignatureTemplate.mutate({ content: signatureTemplate })} disabled={updateSignatureTemplate.isPending || signatureTemplate.trim().length < 2} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#173047] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#244861] disabled:opacity-60"><Save size={16} /> {updateSignatureTemplate.isPending ? "Menyimpan..." : "Simpan template"}</button>
            </section>

            <section className="rounded-[28px] border border-[#173047]/10 bg-white p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow">Permintaan kunjungan</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Antrean yang perlu ditindaklanjuti</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#607684]">Data ini hanya untuk menghubungi pemohon terkait jadwal. Jangan menambahkan catatan klinis atau data medis di luar proses yang disetujui.</p></div>
                <span className="rounded-full bg-[#eef8f8] px-3 py-1.5 text-xs font-bold text-[#007f98]">{appointmentRequests?.length ?? 0} tersimpan</span>
              </div>
              <div className="mt-7 grid gap-4">
                {appointmentRequestsLoading ? <div className="grid min-h-28 place-items-center rounded-2xl bg-[#f5fafb]"><Loader2 className="animate-spin text-[#039CB7]" /></div> : appointmentRequests?.length ? appointmentRequests.map(request => (
                  <article key={request.id} className="rounded-2xl border border-[#173047]/10 bg-[#fbfaf5] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-display text-xl font-semibold">{request.fullName}</p><p className="mt-1 text-sm text-[#607684]">{request.service} · Pilihan tanggal: {new Date(`${request.preferredDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#173047] px-3 py-1 text-white">Nomor antrian: {request.queueNumber}</span><span className="rounded-full bg-[#eaf9fb] px-3 py-1 text-[#007f98]">Jam pilihan: {request.preferredTime}</span><span className="rounded-full bg-[#dff7ed] px-3 py-1 text-emerald-800">Jam layanan: {request.assignedTime}</span></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "new" ? "bg-amber-100 text-amber-800" : request.status === "contacted" ? "bg-[#eaf9fb] text-[#007f98]" : "bg-slate-100 text-slate-600"}`}>{request.status === "new" ? "Baru" : request.status === "contacted" ? "Dihubungi" : "Selesai"}</span></div>
                    {request.note ? <p className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-[#395568]">{request.note}</p> : null}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button onClick={() => setFollowUpRequest({ id: request.id, fullName: request.fullName, contactNumber: request.contactNumber, service: request.service, preferredDate: request.preferredDate })} className="inline-flex items-center gap-2 rounded-full bg-[#eaf9fb] px-4 py-2 text-sm font-bold text-[#007f98] transition hover:bg-[#d7f4f7]"><MessageCircle size={16} /> Draf WhatsApp</button><label className="flex items-center gap-2 text-sm font-bold text-[#395568]">Status<select value={request.status} disabled={updateAppointmentStatus.isPending} onChange={event => updateAppointmentStatus.mutate({ id: request.id, status: event.target.value as "new" | "contacted" | "closed" })} className="rounded-lg border border-[#173047]/15 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:border-[#039CB7]"><option value="new">Baru</option><option value="contacted">Dihubungi</option><option value="closed">Selesai</option></select></label></div>
                  </article>
                )) : <div className="rounded-2xl bg-[#f5fafb] p-6 text-sm leading-6 text-[#607684]"><CheckCircle2 className="mr-2 inline-block h-4 w-4 text-[#039CB7]" />Belum ada permintaan kunjungan yang tersimpan.</div>}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#173047]/10 bg-[#eef8f8] p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow">Riwayat tindak lanjut WhatsApp</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Aktivitas dan panjang draf akhir</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#607684]">Riwayat ini mencatat status tindakan dan jumlah karakter saat staf menyalin draf atau membuka WhatsApp. Isi pesan dan catatan pemohon tidak disimpan.</p></div>
                <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#007f98]">{followUpActivities?.length ?? 0} aktivitas {hasActivityFilters ? "terfilter" : "tersimpan"}</span><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#173047]">Rata-rata {averageFollowUpDraftLength.toLocaleString("id-ID")} karakter</span></div>
              </div>
              <fieldset className="mt-6 grid gap-3 rounded-2xl border border-[#173047]/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
                <legend className="flex items-center gap-2 px-1 text-sm font-bold text-[#173047]"><SlidersHorizontal size={15} className="text-[#007f98]" /> Filter aktivitas</legend>
                <label className="grid gap-1.5 text-xs font-bold text-[#395568]">Status aktivitas<select value={activityStatusFilter} onChange={event => setActivityStatusFilter(event.target.value as FollowUpActivityStatusFilter)} className="rounded-xl border border-[#173047]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"><option value="all">Semua status</option><option value="draft_copied">Draf disalin</option><option value="whatsapp_opened">WhatsApp dibuka</option></select></label>
                <label className="grid gap-1.5 text-xs font-bold text-[#395568]">Dari tanggal<input type="date" value={activityStartDate} onChange={event => setActivityStartDate(event.target.value)} className="rounded-xl border border-[#173047]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" /></label>
                <label className="grid gap-1.5 text-xs font-bold text-[#395568]">Sampai tanggal<input type="date" value={activityEndDate} onChange={event => setActivityEndDate(event.target.value)} className="rounded-xl border border-[#173047]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" /></label>
                <button type="button" onClick={resetActivityFilters} disabled={!hasActivityFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#173047]/15 px-4 py-2.5 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98] disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={15} /> Reset</button>
              </fieldset>
              {activityDateRangeInvalid ? <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">Tanggal mulai tidak boleh setelah tanggal akhir.</p> : null}
              <div className="mt-7 grid gap-3">
                {followUpActivitiesLoading ? <div className="grid min-h-24 place-items-center rounded-2xl bg-white"><Loader2 className="animate-spin text-[#039CB7]" /></div> : followUpActivities?.length ? followUpActivities.map(activity => (
                  <article key={activity.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#173047]/10 bg-white p-4">
                    <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#eaf9fb] text-[#007f98]"><History size={17} /></div><div><p className="text-sm font-bold text-[#173047]">{activity.messageStatus === "draft_copied" ? "Draf disalin" : "WhatsApp dibuka"}</p><p className="mt-1 text-xs text-[#607684]">Permintaan #{activity.appointmentRequestId} · {new Date(activity.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div></div>
                    <div className="text-right"><p className="text-sm font-bold text-[#173047]">{activity.finalDraftLength.toLocaleString("id-ID")} karakter</p><p className="mt-1 text-xs font-semibold text-[#007f98]">Status pesan tercatat</p></div>
                  </article>
                )) : <div className="rounded-2xl bg-white p-6 text-sm leading-6 text-[#607684]"><CheckCircle2 className="mr-2 inline-block h-4 w-4 text-[#039CB7]" />{hasActivityFilters ? "Tidak ada aktivitas yang sesuai dengan filter saat ini." : "Belum ada aktivitas tindak lanjut. Riwayat dibuat saat staf menyalin draf atau membuka WhatsApp."}</div>}
              </div>
            </section>

            <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
              <div className="rounded-[28px] border border-[#173047]/10 bg-white p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
                <p className="eyebrow">Layanan publik</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Tambah kartu layanan</h2>
                <div className="mt-6 grid gap-4">
                  <input value={service.name} onChange={e => setService(current => ({ ...current, name: e.target.value }))} placeholder="Nama layanan" className="rounded-xl border border-[#173047]/15 px-4 py-3 text-sm outline-none focus:border-[#039CB7]" />
                  <textarea value={service.summary} onChange={e => setService(current => ({ ...current, summary: e.target.value }))} placeholder="Ringkasan layanan" rows={4} className="rounded-xl border border-[#173047]/15 px-4 py-3 text-sm outline-none focus:border-[#039CB7]" />
                  <input value={service.imageUrl} onChange={e => setService(current => ({ ...current, imageUrl: e.target.value }))} placeholder="URL gambar dari managed storage" className="rounded-xl border border-[#173047]/15 px-4 py-3 text-sm outline-none focus:border-[#039CB7]" />
                </div>
                <button onClick={() => saveService.mutate({ ...service, sortOrder: (data?.services.length ?? 0) + 1, isPublished: true })} disabled={saveService.isPending || !service.name || !service.summary || !service.imageUrl} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#173047] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#244861] disabled:opacity-60"><Plus size={16} /> Tambah layanan</button>
                <div className="mt-7 grid gap-3">
                  {data?.services.map(item => <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl bg-[#f5fafb] p-4"><div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm leading-6 text-[#607684]">{item.summary}</p></div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#007f98]">{item.isPublished ? "Tayang" : "Draf"}</span></div>)}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#173047]/10 bg-[#eef8f8] p-6 sm:p-8">
                <p className="eyebrow">Managed file storage</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">Unggah aset klinik</h2>
                <p className="mt-3 text-sm leading-6 text-[#607684]">JPG, PNG, WEBP, atau PDF hingga 5 MB. File disimpan ke storage terkelola dan metadata-nya masuk ke database.</p>
                <div className="mt-6 grid gap-4">
                  <input value={assetAlt} onChange={e => setAssetAlt(e.target.value)} placeholder="Teks alternatif aset" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#039CB7]" />
                  <select value={assetCategory} onChange={e => setAssetCategory(e.target.value as typeof assetCategory)} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-[#039CB7]"><option value="service">Layanan</option><option value="facility">Fasilitas</option><option value="clinician">Dokter</option><option value="brand">Brand</option><option value="document">Dokumen</option></select>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#039CB7]/45 bg-white px-5 py-6 text-sm font-bold text-[#007f98] transition hover:bg-[#eafdff]"><UploadCloud size={18} /> {uploadMedia.isPending ? "Mengunggah..." : "Pilih file untuk diunggah"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleUpload} className="sr-only" /></label>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data?.mediaAssets.map(asset => <a key={asset.id} href={asset.publicUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-[#173047]/10 bg-white p-2 text-xs font-bold text-[#395568] transition hover:-translate-y-0.5"><div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-[#f5fafb]">{asset.mimeType.startsWith("image/") ? <img src={asset.publicUrl} alt={asset.altText} className="h-full w-full object-cover" /> : <span>PDF</span>}</div><p className="mt-2 truncate">{asset.fileName}</p></a>)}
                </div>
              </div>
            </section>
          </>
        )}
        <WhatsAppFollowUpDialog request={followUpRequest} signatureTemplate={signatureTemplate} onOpenChange={open => { if (!open) setFollowUpRequest(null); }} onRecordActivity={activity => recordFollowUpActivity.mutate(activity)} />
      </div>
    </DashboardLayout>
  );
}
