import { auth } from "@clerk/nextjs/server";
import RetrySpeakingMockScoringButton from "@/app/dashboard/mock-exam/records/RetrySpeakingMockScoringButton";
import SpeakingMockTabs from "@/components/SpeakingMockTabs";
import { getSpeakingMockSessionDetails } from "@/lib/speaking-mock-records";

type SearchParams = {
  session?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function getStatusLabel(status: string) {
  if (status === "completed") return "评分完成";
  if (status === "processing") return "评分中";
  if (status === "failed") return "评分失败";
  return "已提交";
}

function getStatusClassName(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function canRetryScoring(status: string) {
  return status === "queued" || status === "failed";
}

function getPhaseLabel(phase: string) {
  if (phase === "part2") return "Part 2";
  if (phase === "part3") return "Part 3";
  return "Part 1";
}

function getCriterionLabel(key: string) {
  if (key === "pronunciation") return "Pronunciation";
  if (key === "fluencyAndCoherence") return "Fluency & Coherence";
  if (key === "lexicalResource") return "Lexical Resource";
  return "Grammar Range & Accuracy";
}

function getWordChipClassName(
  accuracyScore: number | null,
  errorType: string | null,
) {
  if (errorType === "Omission" || errorType === "Insertion") {
    return "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200";
  }

  if (accuracyScore === null) {
    return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
  }

  if (accuracyScore >= 85) {
    return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  if (accuracyScore >= 70) {
    return "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200";
  }

  return "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200";
}

function getWordTooltip(accuracyScore: number | null, errorType: string | null) {
  const parts = [];

  if (accuracyScore !== null) {
    parts.push(`Accuracy ${accuracyScore.toFixed(0)}`);
  }

  if (errorType && errorType !== "None") {
    parts.push(errorType);
  }

  return parts.join(" · ");
}

function getWordIssueSummary(
  accuracyScore: number | null,
  errorType: string | null,
) {
  if (errorType === "Omission") {
    return "这个单词有漏读";
  }

  if (errorType === "Insertion") {
    return "这个单词有插入音或多读现象";
  }

  if (accuracyScore === null) {
    return "这个单词暂时没有拿到可用的发音评分";
  }

  if (accuracyScore >= 85) {
    return "这个单词发音基本准确";
  }

  if (accuracyScore >= 70) {
    return "这个单词发音一般，清晰度还可以再提高";
  }

  return "这个单词发音问题比较明显，建议重点跟读修正";
}

function getWordIssueDetail(
  accuracyScore: number | null,
  errorType: string | null,
) {
  if (errorType === "Omission") {
    return "Azure 判断这一处存在漏读，建议放慢语速，把这个词完整读出来。";
  }

  if (errorType === "Insertion") {
    return "Azure 判断这里出现了多余发音，建议减少拖音或多加出来的音节。";
  }

  if (accuracyScore === null) {
    return "这次没有返回足够的逐词细节，可以结合整句录音再判断。";
  }

  if (accuracyScore >= 85) {
    return "这次发音表现稳定，可以继续保持当前口型和重音处理。";
  }

  if (accuracyScore >= 70) {
    return "发音大体能听懂，但元音、辅音清晰度或重音可能还不够稳定。";
  }

  return "这个词的音素或重音偏差较大，建议单独跟读几遍再回到整句练习。";
}

export default async function SpeakingMockRecordsPage({ searchParams }: Props) {
  const { userId } = await auth();
  const { session } = await searchParams;
  const records = userId ? await getSpeakingMockSessionDetails(userId) : [];

  return (
    <div className="space-y-4">
      <SpeakingMockTabs activeTab="records" />

      {/* <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Mock Records
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-900">模考记录</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          这里会显示每次口语模考的提交时间、评分状态、题目数、最终分数和录音历史。评分完成后，也会同步显示整场 AI 点评和逐题转写摘要。
        </p>

        {session ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            最新模考记录已创建。系统会先执行 Azure 发音评分，再生成整场 IELTS Speaking 估分。
          </div>
        ) : null}
      </section> */}

      {!userId ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          登录后才能查看自己的模考记录。
        </section>
      ) : records.length === 0 ? (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          还没有口语模考记录。完成一次 Part 1 或 Part 2 / Part 3 模考并点击提交 AI 评分后，记录会出现在这里。
        </section>
      ) : (
        <section className="grid gap-4">
          {records.map((record) => (
            <article
              key={record.sessionUuid}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-slate-900">
                      {record.topicTitle}
                    </div>
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(record.status)}`}
                    >
                      {getStatusLabel(record.status)}
                    </div>
                  </div>

                  <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {record.group === "part1" ? "Part 1" : "Part 2 & Part 3"}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        提交时间
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">
                        {formatDateTime(record.submittedAt)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        题目数量
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">
                        {record.answeredCount}/{record.turnCount}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        预估总分
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">
                        {record.overallBand ? record.overallBand.toFixed(1) : "待生成"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600 lg:max-w-sm">
                  <div className="font-semibold text-slate-900">当前状态</div>
                  <div className="mt-2">
                    {record.status === "completed"
                      ? "Azure 发音评分和整场 IELTS Speaking 估分都已完成，可以查看总评、维度点评和历史录音。"
                      : record.status === "failed"
                        ? record.errorMessage || "本次评分流程执行失败，可以根据错误信息重试。"
                      : "录音已上传，系统正在处理逐题发音评分和整场口语估分。"}
                  </div>

                  {canRetryScoring(record.status) ? (
                    <RetrySpeakingMockScoringButton
                      sessionUuid={record.sessionUuid}
                    />
                  ) : null}
                </div>
              </div>

              {record.status === "completed" ? (
                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">AI 总评</div>
                    <div className="mt-3 text-sm leading-7 text-slate-700">
                      {record.overview || "本次口语评分已完成。"}
                    </div>

                    {record.strengths.length > 0 ? (
                      <div className="mt-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          表现亮点
                        </div>
                        <div className="mt-2 space-y-2">
                          {record.strengths.map((strength, index) => (
                            <div
                              key={`${record.sessionUuid}-strength-${index}`}
                              className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-600"
                            >
                              {strength}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {record.suggestions.length > 0 ? (
                      <div className="mt-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          提分建议
                        </div>
                        <div className="mt-2 space-y-2">
                          {record.suggestions.map((suggestion, index) => (
                            <div
                              key={`${record.sessionUuid}-suggestion-${index}`}
                              className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-600"
                            >
                              <div className="font-semibold text-slate-900">
                                {suggestion.title}
                              </div>
                              <div className="mt-1">{suggestion.action}</div>
                              <div className="mt-1 text-slate-500">
                                示例练法：{suggestion.example}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {Object.entries(record.criteria).map(([key, criterion]) =>
                      criterion ? (
                        <div
                          key={`${record.sessionUuid}-${key}`}
                          className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">
                              {getCriterionLabel(key)}
                            </div>
                            <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                              {criterion.band.toFixed(1)}
                            </div>
                          </div>
                          <div className="mt-3 text-sm leading-7 text-slate-600">
                            {criterion.comment}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="text-sm font-semibold text-slate-900">
                  历史音频
                </div>

                <div className="mt-3 space-y-3">
                  {record.turns.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      当前记录还没有可展示的题目音频。
                    </div>
                  ) : (
                    record.turns.map((turn, index) => (
                      <div
                        key={turn.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {getPhaseLabel(turn.phase)}
                          </div>
                          <div className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">
                            Turn {index + 1}
                          </div>
                        </div>

                        <div className="mt-3 text-sm leading-7 text-slate-700">
                          {turn.questionText}
                        </div>

                        {turn.transcriptText ? (
                          <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-7 text-slate-600">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Transcript
                            </div>
                            {turn.transcriptWords.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {turn.transcriptWords.map((word, wordIndex) => {
                                  const tooltip = getWordTooltip(
                                    word.accuracyScore,
                                    word.errorType,
                                  );
                                  const issueSummary = getWordIssueSummary(
                                    word.accuracyScore,
                                    word.errorType,
                                  );
                                  const issueDetail = getWordIssueDetail(
                                    word.accuracyScore,
                                    word.errorType,
                                  );

                                  return (
                                    <span
                                      key={`${turn.id}-word-${wordIndex}`}
                                      title={tooltip || undefined}
                                      className="group relative inline-flex"
                                    >
                                      <span
                                        className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${getWordChipClassName(
                                          word.accuracyScore,
                                          word.errorType,
                                        )}`}
                                      >
                                        {word.text}
                                      </span>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-2xl bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-white shadow-xl group-hover:block">
                                        <span className="block font-semibold">
                                          {issueSummary}
                                        </span>
                                        <span className="mt-1 block text-slate-200">
                                          {issueDetail}
                                        </span>
                                        {tooltip ? (
                                          <span className="mt-1 block text-slate-400">
                                            {tooltip}
                                          </span>
                                        ) : null}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-2">{turn.transcriptText}</div>
                            )}
                          </div>
                        ) : null}

                        {/* {typeof turn.pronunciationScore === "number" ? (
                          <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                            Azure Pronunciation: {turn.pronunciationScore.toFixed(1)}
                          </div>
                        ) : null} */}

                        {turn.isHistoryAudio && turn.userAudioUrl ? (
                          <audio
                            controls
                            src={turn.userAudioUrl}
                            className="mt-4 w-full"
                          />
                        ) : (
                          <div className="mt-4 text-sm text-slate-500">
                            该题录音未保存到 PRO 历史音频目录，历史页不提供重听。
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
