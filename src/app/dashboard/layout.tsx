"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/practice", label: "Practice" },
  { href: "/dashboard/voice", label: "Voice Lab" },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <main className="ielts-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[2rem] p-5">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="优秀IELTS"
              width={160}
              height={44}
              className="h-9 w-auto"
            />
          </Link>
          <p className="text-ink-soft mt-3 text-sm leading-7">
            这里是受保护区域。路由会经过 Clerk middleware，未登录用户会被送去登录页。
          </p>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                    active ? "bg-slate-900 text-white" : "bg-white/70 text-slate-700 hover:bg-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 flex items-center gap-3 rounded-[1.5rem] border border-[var(--line)] bg-white/72 px-4 py-4">
            <UserButton />
            <div className="text-sm text-slate-600">账号中心</div>
          </div>
        </aside>

        <section className="glass-panel rounded-[2rem] p-4 sm:p-6">{children}</section>
      </div>
    </main>
  );
}
