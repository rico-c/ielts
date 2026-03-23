import Link from "next/link";

type SpeakingMockTabsProps = {
  activeTab: "random" | "records";
};

export default function SpeakingMockTabs({
  activeTab,
}: SpeakingMockTabsProps) {
  return (
    <div className="inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-sm shadow-slate-200/60 backdrop-blur">
      <div className="flex items-center gap-1">
        <Link
          href="/dashboard/mock-exam"
          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "random"
              ? "bg-slate-900 text-white! shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          当季题库
        </Link>
        <Link
          href="/dashboard/mock-exam/records"
          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "records"
              ? "bg-slate-900 text-white! shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          模考记录
        </Link>
      </div>
    </div>
  );
}
