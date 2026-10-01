import { trpc } from "@/lib/trpc";
import { OSD_ANNOUNCEMENT, OSD_YOUTUBE_PLAYLIST_URL } from "@shared/osd";
import { Activity, Clock3, Loader2, MonitorPlay, Radio, Users } from "lucide-react";

function QueueCard({ item, treatment = false }: { item: { queueNumber: number; fullName: string; service: string; doctor: string; assignedTime: string }; treatment?: boolean }) {
  return (
    <article className={`rounded-2xl border p-4 ${treatment ? "border-emerald-300/20 bg-emerald-400/10" : "border-white/10 bg-white/[.06]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{item.fullName}</p>
          <p className="mt-1 text-sm font-semibold text-cyan-200">{item.service}</p>
          <p className="mt-1 truncate text-xs text-slate-300">{item.doctor}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-black tracking-tight text-white">{item.queueNumber}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.assignedTime}</p>
        </div>
      </div>
    </article>
  );
}

export default function Osd() {
  const { data, isLoading, isError, dataUpdatedAt } = trpc.osd.snapshot.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const todayLabel = data?.today ? new Date(`${data.today}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Memuat tanggal";
  const active = data?.active ?? null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#081521] text-white">
      <header className="flex items-center justify-between gap-6 border-b border-white/10 bg-[#0d2333] px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#039CB7] shadow-lg shadow-cyan-950/40"><Activity size={23} /></div><div><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">Klinik Berkat Insani</p><h1 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">OSD Antrean Kunjungan</h1></div></div>
        <div className="text-right"><p className="text-sm font-bold text-white">{todayLabel}</p><p className="mt-1 flex items-center justify-end gap-1.5 text-xs text-slate-400"><Radio size={12} className="text-emerald-400" /> Pembaruan otomatis setiap 5 detik</p></div>
      </header>

      <div className="grid min-h-[calc(100vh-141px)] gap-5 p-5 lg:grid-cols-[1.05fr_1.35fr] lg:p-7">
        <section className="flex min-h-0 flex-col gap-5">
          <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/20">
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white backdrop-blur"><MonitorPlay size={15} className="text-cyan-300" /> Edukasi kesehatan</div>
            <iframe className="h-full min-h-[260px] w-full" src={OSD_YOUTUBE_PLAYLIST_URL} title="Video edukasi kesehatan" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </div>
          <div className="rounded-3xl border border-cyan-300/15 bg-[#10364a] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Informasi layanan</p><p className="mt-3 text-base font-semibold leading-7 text-white lg:text-lg">Silakan menunggu panggilan nomor antrean. Pastikan tetap berada di area klinik.</p></div>
        </section>

        <section className="flex min-h-0 flex-col gap-5">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#039CB7] via-[#087f9c] to-[#12344a] p-6 shadow-2xl shadow-cyan-950/30 lg:p-8" aria-live="polite">
            <div className="flex items-center justify-between gap-4"><p className="text-sm font-black uppercase tracking-[.2em] text-cyan-50">{active?.status === "contacted" ? "Sedang ditangani" : "Nomor berikutnya"}</p><Clock3 size={23} className="text-cyan-100" /></div>
            {isLoading ? <Loader2 className="mt-7 animate-spin text-white" size={48} /> : isError ? <p className="mt-7 text-lg font-bold text-white">Data antrean belum dapat dimuat.</p> : active ? <div className="mt-4 flex items-end justify-between gap-5"><div className="min-w-0"><p className="truncate text-2xl font-bold text-white lg:text-3xl">{active.fullName}</p><p className="mt-2 text-base font-semibold text-cyan-100">{active.service}</p><p className="mt-1 text-sm text-cyan-100/80">{active.doctor}</p></div><p className="text-8xl font-black leading-none tracking-[-.08em] text-white lg:text-[10rem]">{active.queueNumber}</p></div> : <div className="mt-7"><p className="text-5xl font-black text-white lg:text-7xl">—</p><p className="mt-3 text-base text-cyan-50">Belum ada antrean aktif.</p></div>}
          </div>

          <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-2">
            <section className="min-h-0 rounded-3xl border border-white/10 bg-[#0d2333] p-5"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Users size={19} className="text-cyan-300" /> Menunggu dipanggil</h2><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-cyan-100">{data?.waiting.length ?? 0}</span></div><div className="mt-4 grid max-h-[31vh] gap-3 overflow-y-auto pr-1">{data?.waiting.length ? data.waiting.map(item => <QueueCard key={item.queueNumber} item={item} />) : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">Belum ada pasien yang menunggu dipanggil.</p>}</div></section>
            <section className="min-h-0 rounded-3xl border border-emerald-300/15 bg-[#0d2333] p-5"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Activity size={19} className="text-emerald-300" /> Sedang ditangani</h2><span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">{data?.inTreatment.length ?? 0}</span></div><div className="mt-4 grid max-h-[31vh] gap-3 overflow-y-auto pr-1">{data?.inTreatment.length ? data.inTreatment.map(item => <QueueCard key={item.queueNumber} item={item} treatment />) : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">Belum ada pasien yang sedang ditangani.</p>}</div></section>
          </div>
        </section>
      </div>

      <footer className="relative overflow-hidden border-t border-white/10 bg-[#039CB7] py-3"><div className="whitespace-nowrap text-sm font-bold text-white" style={{ animation: "osd-marquee 28s linear infinite" }}>{OSD_ANNOUNCEMENT}&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;{OSD_ANNOUNCEMENT}</div><span className="sr-only">Terakhir diperbarui {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("id-ID") : "belum tersedia"}</span></footer>
    </main>
  );
}
