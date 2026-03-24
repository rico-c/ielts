import type { CSSProperties } from "react";
import { Quote, Star } from "lucide-react";

interface Review {
  name: string;
  score: string;
  content: string;
  avatar: string;
}

const reviews: Review[] = [
  {
    name: "Luna Lin",
    score: "首考总分 7.5",
    content:
      "口语模拟真的很顶，Part 1 到 Part 3 能连续练，开口焦虑少了很多，考试时状态比以前稳太多。",
    avatar: "LL",
  },
  {
    name: "Zoe Xu",
    score: "听力 8.5",
    content:
      "我最喜欢听力和题组在一个页面里做完，做题、对答案、回看错题都顺着来，不会再切来切去。",
    avatar: "ZX",
  },
  {
    name: "Kevin He",
    score: "写作提到 6.5",
    content:
      "原来写作总是没有方向，现在至少训练路径很清晰，知道先练什么、后补什么，效率高很多。",
    avatar: "KH",
  },
  {
    name: "Mia Sun",
    score: "阅读 8.0",
    content:
      "阅读的结构化展示很舒服，能快速定位题号和原文证据点，复盘比我以前自己整理轻松太多。",
    avatar: "MS",
  },
  {
    name: "Ethan Gu",
    score: "Part 2 不再卡壳",
    content:
      "以前最怕口语卡住，现在用首页的 AI 口语入口每天练一会儿，临场组织语言明显更快了。",
    avatar: "EG",
  },
  {
    name: "Vivian Gao",
    score: "备考节奏稳定",
    content:
      "这个平台最强的是把开始练习、继续练习和复盘接起来了，我终于不是三天打鱼两天晒网。",
    avatar: "VG",
  },
  {
    name: "Jason Chen",
    score: "申请前顺利冲分",
    content:
      "临近申请季的时候最怕乱，这套流程把口语、真题和 dashboard 串在一起，省下了很多无效时间。",
    avatar: "JC",
  },
  {
    name: "Chloe Wu",
    score: "每天都能坚持练",
    content:
      "界面很顺手，不会有那种一打开就不想学的压迫感。对我这种需要长期坚持的人特别友好。",
    avatar: "CW",
  },
];

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="mx-4 w-[350px] rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white text-sm font-bold text-blue-600 shadow-sm">
            {review.avatar}
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">{review.name}</h4>
            <p className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              {review.score}
            </p>
          </div>
        </div>
        <Quote className="h-6 w-6 text-gray-300" />
      </div>

      <div className="mb-3 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className="h-4 w-4 fill-amber-400 text-amber-400"
          />
        ))}
      </div>

      <p className="text-sm leading-relaxed text-gray-600">{review.content}</p>
    </div>
  );
}

function ReviewRow({
  items,
  reverse = false,
  duration,
}: {
  items: Review[];
  reverse?: boolean;
  duration: string;
}) {
  return (
    <div className="testimonial-marquee overflow-y-hidden">
      <div
        className={`testimonial-marquee-track ${
          reverse
            ? "testimonial-marquee-track-reverse"
            : "testimonial-marquee-track-forward"
        }`}
        style={{ "--testimonial-duration": duration } as CSSProperties}
      >
        {[0, 1].map((copyIndex) => (
          <div
            key={copyIndex}
            className="flex w-max shrink-0"
            aria-hidden={copyIndex === 1}
          >
            {items.map((review) => (
              <ReviewCard
                key={`${review.name}-${copyIndex}`}
                review={review}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Testimonials() {
  const firstRow = reviews.slice(0, 4);
  const secondRow = reviews.slice(4, 8);

  return (
    <section className="overflow-hidden bg-white py-24">
      <div className="mb-16 px-4 text-center">
        <h2 className="mb-4 text-3xl font-bold text-gray-900">用户好评</h2>
        <p className="mx-auto max-w-2xl text-gray-500">
          真正被同学反复提到的，不只是分数提升，还有更顺手、更能坚持的备考体验。
        </p>
      </div>

      <div className="flex flex-col gap-8 overflow-y-hidden">
        <ReviewRow items={firstRow} duration="40s" />
        <ReviewRow items={secondRow} reverse duration="32s" />
      </div>
    </section>
  );
}
