import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-4 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border border-white/60 bg-white/80 px-4 shadow-lg shadow-slate-200/30 backdrop-blur-md sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="优秀雅思"
            width={160}
            height={40}
            className="h-12 w-auto"
            priority
            unoptimized
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/#features" className="transition-colors hover:text-blue-600">
            功能
          </Link>
          <Link href="/#pricing" className="transition-colors hover:text-blue-600">
            价格
          </Link>
          <Link href="/blogs" className="transition-colors hover:text-blue-600">
            博客
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                登录/注册
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 sm:inline-flex"
            >
              进入备考平台
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
