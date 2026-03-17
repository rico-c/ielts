import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私政策 - 优秀IELTS",
  description: "优秀IELTS 隐私政策",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="优秀IELTS"
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">隐私政策</h1>
          <p className="mb-8 text-sm text-gray-500">最后更新：2026年3月</p>

          <div className="space-y-8 leading-relaxed">
            <section>
              <p className="mb-4">
                除非适用法律另有规定，您在使用本网站、应用页面及相关服务时，
                即表示您同意我们根据本隐私政策收集、使用、处理、存储及披露
                与您相关的个人数据。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                隐私政策的修改
              </h2>
              <p className="mb-4">
                我们会不时审查并更新隐私政策。更新版本将在网站发布后生效。
                若您在政策更新后继续使用本网站或相关服务，即视为您已知悉并同意
                更新后的政策内容。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                信息收集
              </h2>
              <p className="mb-4">
                您可以在不主动提交个人信息的情况下浏览本网站的部分页面。当您注册、
                登录、购买、联系我们、提交练习内容或使用个性化功能时，我们可能收集
                您提供的信息，例如姓名、邮箱地址、手机号、账户标识、头像及学习记录。
              </p>
              <p className="mb-4">
                我们还可能收集与服务使用相关的信息，包括设备信息、浏览器信息、
                IP 地址、访问路径、页面交互、登录时间、功能使用情况与错误日志。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                自动收集的信息
              </h2>
              <p className="mb-4">
                为改进平台稳定性、性能和体验，我们可能自动记录您访问前后的页面、
                URL 来源、浏览器类型、设备信息、访问时间及交互行为，并以汇总或分析
                的方式用于运营、诊断和产品优化。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                您主动提供的信息
              </h2>
              <p className="mb-4">
                当您向我们发送邮件、提交反馈、参与客服沟通或在平台中上传内容时，
                我们会保存您主动提供的信息，用于响应请求、排查问题、改进服务或
                处理争议。
              </p>
              <p className="mb-4">
                当您创建账户后，我们可能使用您的联系方式向您发送与服务相关的通知、
                安全提醒、交易消息以及必要的运营信息。即使您退订部分营销邮件，
                我们仍可能发送重要的账户或服务通知。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                信息的准确性
              </h2>
              <p className="mb-4">
                您应确保向我们提供的信息完整、准确并保持更新。若您未及时更新资料，
                可能导致我们无法正常向您提供某些服务或支持。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                数据用途
              </h2>
              <ul className="mb-4 list-disc space-y-2 pl-6">
                <li>向您提供账户、练习、评分、记录与学习相关功能。</li>
                <li>识别、预防与处理安全问题、欺诈行为与违规使用。</li>
                <li>改进平台性能、内容质量与产品体验。</li>
                <li>发送必要的服务通知、支持回复与交易信息。</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                数据安全
              </h2>
              <p className="mb-4">
                我们会采取合理的技术和组织措施来保护您的个人数据，防止未经授权的
                访问、披露、篡改或丢失。但互联网传输并非绝对安全，因此我们无法保证
                所有数据在传输过程中的绝对安全。
              </p>
              <p className="mb-4">
                我们建议您使用强密码、妥善保管登录信息，并在公共或共享设备上使用完
                服务后及时退出账户。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                数据删除
              </h2>
              <p className="mb-4">
                您可以联系我们申请删除账户及相关个人数据。我们将在适用法律和合理
                技术能力范围内处理您的删除请求，并在必要时向您确认处理结果。
              </p>
            </section>

            <section>
              <h2 className="mb-4 mt-8 text-2xl font-semibold text-gray-900">
                联系我们
              </h2>
              <p className="mb-4">
                如您对本隐私政策有疑问，或希望申请删除个人数据，请联系：
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
