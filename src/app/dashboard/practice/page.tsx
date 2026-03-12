export default function DashboardPracticePage() {
  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6">
      <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
        Practice
      </div>
      <h1 className="font-display mt-5 text-4xl leading-tight text-slate-900">这里预留给题型练习页。</h1>
      <p className="text-ink-soft mt-5 max-w-2xl text-sm leading-7">
        目前先放占位页，主要是为了把 dashboard 的导航和权限控制走通。后续你可以把 `IeltsTestRenderer`
        拆成题型列表、单题练习、错题本和个人记录。
      </p>
    </section>
  );
}
