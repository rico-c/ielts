import { auth, clerkClient } from "@clerk/nextjs/server";
import SettingsActions from "@/app/dashboard/settings/SettingsActions";

export default async function SettingsPage() {
  const { userId } = await auth();
  let email = "未登录";

  if (userId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.primaryEmailAddress?.emailAddress ?? "暂无邮箱";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">设置</h1>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">账户信息</h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div>
              <span className="font-medium text-slate-500">用户ID:</span>{" "}
              <span className="break-all font-mono text-slate-900">{userId ?? "未登录"}</span>
            </div>
            <div className="mt-4">
              <span className="font-medium text-slate-500">用户邮箱:</span>{" "}
              <span className="break-all font-mono text-slate-900">{email}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">账户操作</h2>
            <p className="mt-1 text-sm text-slate-600">
              你可以退出当前会话，或者永久注销当前账户。
            </p>
          </div>

          <SettingsActions />
        </div>
      </section>
    </div>
  );
}
