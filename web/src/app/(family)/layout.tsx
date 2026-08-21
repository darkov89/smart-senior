import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function FamilyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col bg-brand-50">
      <header className="sticky top-0 z-10 border-b border-teal-100 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Dla bliskich</h1>
          <SignOutButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 py-6">{children}</div>
    </div>
  );
}
