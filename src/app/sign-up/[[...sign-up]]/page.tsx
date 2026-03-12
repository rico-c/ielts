import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="ielts-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel w-full max-w-5xl overflow-hidden rounded-[2rem]">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <section className="border-b border-[var(--line)] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Sign up
            </div>
            <h1 className="font-display mt-6 text-5xl leading-none text-slate-900">
              创建账号后，
              <br />
              直接开始练习。
            </h1>
            <p className="text-ink-soft mt-6 max-w-md text-sm leading-7">
              注册成功后会跳转到 `/dashboard`。后续如果你给题目、进度或订阅做用户级数据隔离，这套入口可以直接承接。
            </p>
          </section>
          <section className="flex items-center justify-center px-6 py-8 lg:px-10 lg:py-12">
            <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
          </section>
        </div>
      </div>
    </main>
  );
}
