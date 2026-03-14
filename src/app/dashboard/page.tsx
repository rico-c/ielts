import Link from "next/link";
import ElevenLabsVoiceAssistant from "@/components/ElevenLabsVoiceAssistant";
import IeltsTestRenderer from "@/components/IeltsTestRenderer";

const quickActions = [
  {
    title: "Practice Hub",
    description: "进入题型练习页，后续可以继续拆分听说读写与错题本。",
    href: "/dashboard/practice",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    title: "Voice Lab",
    description: "单独进入口语训练区，适合继续承接会话记录和分数分析。",
    href: "/dashboard/voice",
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    title: "Latest Tests",
    description: "直接在 dashboard 内查看最新题目结构和答案。",
    href: "#latest-tests",
    tone: "bg-emerald-50 text-emerald-700",
  },
];

const summaryCards = [
  { label: "Workspace", value: "IELTS", description: "与 PTE 的 dashboard 层级对齐" },
  { label: "Core Action", value: "2", description: "练习页 + 口语页" },
  { label: "Live Voice", value: "ON", description: "保留当前 ElevenLabs 入口" },
  { label: "Latest Test", value: "SYNC", description: "题库预览直接留在面板里" },
];

export default function DashboardPage() {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-gray-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-sm">
            Dashboard Overview
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-gray-900">
            首页和 dashboard
            <br />
            现在使用接近 `pte` 的同一套结构
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
            顶部概览、右侧统计卡、下方快捷入口，再接口语训练和题库预览，这一层级基本复用了 PTE dashboard 的工作台思路。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              开始练习
            </Link>
            <Link
              href="/dashboard/voice"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              打开 Voice Lab
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-[1.5rem] border border-gray-100 bg-white p-6 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-blue-600">{card.value}</div>
              <div className="mt-2 font-semibold text-gray-900">{card.label}</div>
              <div className="mt-1 text-xs text-gray-500">{card.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickActions.map((item) => (
          <article key={item.title} className="rounded-[1.5rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>{item.title}</div>
            <p className="mt-4 text-sm leading-7 text-gray-600">{item.description}</p>
            <Link href={item.href} className="mt-6 inline-flex text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700">
              进入
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Voice Lab</h2>
          <p className="mt-2 text-sm leading-7 text-gray-600">
            保留当前语音助教能力，但放到和 PTE dashboard 一致的卡片容器和页面层次里。
          </p>
        </div>
        <ElevenLabsVoiceAssistant agentId={agentId} />
      </section>

      <section id="latest-tests" className="rounded-[1.75rem] border border-gray-100 bg-white p-2 shadow-sm sm:p-4">
        <div className="px-4 pt-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-gray-900">Latest Test Preview</h2>
          <p className="mt-2 text-sm leading-7 text-gray-600">
            继续把题库预览保留在 dashboard 首页，便于后续扩成完整的个人练习工作台。
          </p>
        </div>
        <IeltsTestRenderer />
      </section>
    </div>
  );
}
