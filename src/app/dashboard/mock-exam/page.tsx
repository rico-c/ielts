import SpeakingMockTopicPicker from "@/components/SpeakingMockTopicPicker";
import { getSpeakingMockCatalog } from "@/lib/speaking-db";

export default async function MockExamPage() {
  const catalog = await getSpeakingMockCatalog();

  return (
    <div className="space-y-4">
      {/* <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">口语模考</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          先从当季口语题库里选 Topic。你可以先查看题目，也可以直接进入下一层模考界面。
        </p>
      </div> */}

      <SpeakingMockTopicPicker catalog={catalog} />
    </div>
  );
}
