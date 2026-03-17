export default function WordReviewPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Word Review</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">单词复习</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          这里会放 IELTS 高频词、分主题词组、记忆卡片和错词回看。当前先把入口接入导航，方便后续继续扩展完整的复习工作流。
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm text-slate-600">
          下一步可以继续补：
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>按分数段划分的词汇 deck</li>
          <li>生词收藏与复习进度</li>
          <li>例句、发音与间隔重复</li>
        </ul>
      </div>
    </section>
  );
}
