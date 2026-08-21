import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Placówka</h1>
          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
            <Link
              href="/placowka"
              className="text-brand-800 underline-offset-2 hover:underline"
            >
              Tablica
            </Link>
            <Link
              href="/placowka/zatwierdzenia"
              className="text-brand-800 underline-offset-2 hover:underline"
            >
              Wieczorne zatwierdzenie
            </Link>
            <Link
              href="/placowka/plan-dnia"
              className="text-brand-800 underline-offset-2 hover:underline"
            >
              Plan dnia
            </Link>
            <Link
              href="/placowka/uprawnienia"
              className="text-brand-800 underline-offset-2 hover:underline"
            >
              Podopieczni
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        {children}
      </div>
    </div>
  );
}
