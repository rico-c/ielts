"use client";

import { SignOutButton, useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsActions() {
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeleteAccount() {
    if (!user || isDeleting) return;

    const confirmed = window.confirm("确认注销账户吗？此操作不可恢复。");
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      await user.delete();
      await clerk.signOut({ redirectUrl: "/" });
      router.replace("/");
    } catch (error) {
      console.error("Failed to delete account:", error);
      setDeleteError("注销账户失败，请稍后重试。");
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <SignOutButton redirectUrl="/">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          退出登录
        </button>
      </SignOutButton>

      <button
        type="button"
        onClick={() => {
          void handleDeleteAccount();
        }}
        disabled={isDeleting}
        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm ml-6 font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "正在注销账户..." : "注销账户"}
      </button>

      {deleteError ? (
        <p className="text-sm text-rose-600">{deleteError}</p>
      ) : null}
    </div>
  );
}
