import Link from "next/link";
import { isPublicSupabaseConfigured } from "@/lib/config";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white/95 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dzień dobry</h1>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-8">
        <p className="text-base leading-relaxed text-slate-600">
          Spokojny podgląd dnia dla bliskich i personelu domu opieki.
        </p>
        {!isPublicSupabaseConfigured() ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Aplikacja czeka na podłączenie. Zalogowanie będzie możliwe, gdy
            administrator dokończy konfigurację.
          </p>
        ) : null}
        <Link
          href="/logowanie"
          className="rounded-2xl bg-brand-700 px-5 py-4 text-center text-lg font-semibold text-white hover:bg-brand-800"
        >
          Zaloguj się
        </Link>
        <Link
          href="/aktywacja"
          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-base font-medium text-slate-800 hover:border-brand-600"
        >
          Aktywuj zaproszenie
        </Link>
      </main>
    </div>
  );
}
