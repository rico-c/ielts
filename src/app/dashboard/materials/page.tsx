import ExclusiveMaterialsPanel from "@/components/ExclusiveMaterialsPanel";

export default function MaterialsPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 shadow-sm sm:p-8">
        <div className="absolute -left-12 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-cyan-200/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative">
          <p className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 shadow-sm">
            Exclusive Materials
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            独家资料中心
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            优秀雅思精选备考资料，持续更新中...
          </p>
        </div>
      </section>

      <ExclusiveMaterialsPanel />
    </div>
  );
}
