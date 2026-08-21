import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        {children}
      </main>
    </div>
  );
}
