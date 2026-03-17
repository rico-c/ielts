export default function MaterialsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Exclusive Materials</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">独家资料</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          这里会集中放备考手册、题型拆解、写作模板、口语素材和阶段冲刺资料。当前先提供基础页面，确保导航入口可用。
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm text-slate-600">
          后续可以继续接入：
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>PDF / 外链资料列表</li>
          <li>按听说读写分类的内部资料库</li>
          <li>会员专属下载权限</li>
        </ul>
      </div>
    </section>
  );
}
