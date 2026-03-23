import SpeakingMockTabs from "@/components/SpeakingMockTabs";

export default function SpeakingMockRecordsPage() {
  return (
    <div className="space-y-4">
      <SpeakingMockTabs activeTab="records" />

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Mock Records
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-900">模考记录</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          这里后面可以接用户每次口语模考的题目、录音、评分结果和时间记录。当前先把入口和页面结构预留出来。
        </p>
      </section>
    </div>
  );
}
