import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服务条款 - 优秀雅思",
  description: "优秀雅思 服务条款",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="优秀雅思"
              width={120}
              height={30}
              className="rounded-lg"
              unoptimized
            />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-none rounded-lg bg-white p-8 text-gray-700 shadow-sm md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">服务条款</h1>
          <p className="mb-8 text-sm text-gray-500">最后更新：2026年3月</p>

          <div className="space-y-8 leading-relaxed">
            <section>
              <p className="mb-4">
                本服务条款规定了您访问和使用网站 `ielts.youshowedu.com`
                以及链接或引用本条款的相关服务页面时的权利和义务。本网站由
                Youshow Education PTY LTD（以下简称“优秀雅思”）运营。
              </p>
              <p className="mb-4">
                本条款构成您与 Youshow Education PTY LTD
                之间具有法律约束力的协议。通过访问、浏览、注册或使用本平台，
                您即表示已阅读、理解并同意受本条款约束。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                条款的修改
              </h2>
              <p className="mb-4">
                我们可随时通过在网站上发布更新版本来修改本条款。修订后的条款
                一经发布即生效，并取代此前版本。若您在条款变更后继续使用本网站
                或相关服务，即视为您接受更新后的条款。若您不同意任何修改，请立即
                停止使用本平台。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                服务说明
              </h2>
              <p className="mb-4">
                优秀雅思 是一个在线 IELTS
                备考与练习平台，提供雅思口语模拟、听力/阅读/写作练习、
                学习记录与相关数字化工具。我们提供的是电子化学习支持服务，
                不构成线下或一对一教学培训服务，除非另有明确说明。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                平台责任范围
              </h2>
              <p className="mb-2">优秀雅思 的责任限于：</p>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>提供网站中展示的练习、模拟与学习辅助功能。</li>
                <li>在合理范围内提供客户支持与账户协助。</li>
                <li>维护平台基本可用性并持续优化体验。</li>
              </ul>
              <p className="mb-2">优秀雅思 不对以下事项作出保证：</p>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>任何考试结果、分数或录取结果的必然实现。</li>
                <li>第三方服务、插件、支付或外部链接内容的持续可用性。</li>
                <li>用户因设备、网络或环境问题导致的使用中断。</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                用户保证
              </h2>
              <p className="mb-4">当您注册、访问或使用本平台时，您保证：</p>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>您具有签署并履行本条款所需的法律行为能力。</li>
                <li>您向我们提供的信息真实、准确、完整且保持更新。</li>
                <li>您不会以违法、欺诈或侵犯他人权益的方式使用本平台。</li>
              </ul>
              <p className="mb-4">
                若您未满 18
                周岁，应在父母或法定监护人知情并同意的情况下使用本网站。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                使用限制
              </h2>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>您仅可将本平台用于个人、合法、非商业性的学习用途。</li>
                <li>
                  未经书面许可，您不得复制、抓取、传播、转售、再许可或商业化使用
                  平台中的题目、答案、页面结构、图像、音频或其他内容。
                </li>
                <li>
                  您不得利用本平台上传、发布或传播违法、侵权、骚扰、侮辱、恶意代码、
                  垃圾信息或其他可能损害平台与第三方权益的内容。
                </li>
                <li>
                  您不得尝试绕过访问限制、批量导出内容、逆向工程或干扰平台正常运行。
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                用户账户
              </h2>
              <p className="mb-4">
                您可能需要注册账户后才能使用部分功能。您有责任妥善保管账户、
                密码和登录凭证，并对您账户项下发生的活动承担责任。
              </p>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>如发现未经授权的账户使用，请及时联系我们。</li>
                <li>请确保注册信息持续准确，并在变更时及时更新。</li>
                <li>
                  若我们合理怀疑账户被滥用、共享、抓取或用于违规用途，有权限制或终止访问。
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                第三方链接与服务
              </h2>
              <p className="mb-4">
                本平台可能包含第三方网站、工具或服务的链接。该等第三方内容不受
                我们控制，您访问该等内容时应自行判断并遵守其适用条款与政策。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                电子通信
              </h2>
              <p className="mb-4">
                当您使用本网站、提交表单、发送邮件或接收系统通知时，即表示您同意
                通过电子方式与我们通信。我们可能通过电子邮件、站内提示或其他电子方式
                向您发送与账户、服务或政策相关的信息。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                联系我们
              </h2>
              <p className="mb-4">
                如您对本服务条款有任何疑问，请联系：
                <a
                  href="mailto:official@youshowedu.com"
                  className="text-blue-600 hover:text-blue-800"
                >
                  official@youshowedu.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-center text-sm text-gray-500">
              © {new Date().getFullYear()} Youshow Education PTY LTD. 保留所有权利。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
