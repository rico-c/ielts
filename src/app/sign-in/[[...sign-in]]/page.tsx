import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="ielts-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel w-full max-w-5xl overflow-hidden rounded-[2rem]">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <section className="border-b border-[var(--line)] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
            <div className="section-kicker inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
              Sign in
            </div>
            <h1 className="font-display mt-6 text-5xl leading-none text-slate-900">
              登录后进入
              <br />
              你的 IELTS dashboard
            </h1>
            <p className="text-ink-soft mt-6 max-w-md text-sm leading-7">
              这里沿用 `pte` 的思路做路由保护。未登录用户不能直接访问 `/dashboard`，
              登录后会回到个人训练空间。
            </p>
          </section>
          <section className="flex items-center justify-center px-6 py-8 lg:px-10 lg:py-12">
            <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
          </section>
        </div>
      </div>
    </main>
  );
}
