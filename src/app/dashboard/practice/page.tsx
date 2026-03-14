export default function DashboardPracticePage() {
  return (
    <section className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
        Practice
      </div>
      <h1 className="mt-5 text-4xl font-extrabold leading-tight text-gray-900">这里预留给题型练习页。</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-gray-600">
        目前先放占位页，主要是为了把 dashboard 的导航和权限控制走通。后续你可以把 `IeltsTestRenderer`
        拆成题型列表、单题练习、错题本和个人记录。
      </p>
    </section>
  );
}
