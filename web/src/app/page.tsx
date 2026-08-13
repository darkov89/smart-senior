import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white/95 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Dzień dobry
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-8">
        <p className="text-base leading-relaxed text-slate-600">
          Wybierz, w jakim charakterze tu zaglądasz.
        </p>

        <Link
          href="/rodzina"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-600"
        >
          <p className="text-lg font-semibold text-slate-900">Dla rodziny</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Krótka relacja z dnia — bez medycznego żargonu.
          </p>
        </Link>

        <Link
          href="/placowka"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-600"
        >
          <p className="text-lg font-semibold text-slate-900">Dla personelu</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Podgląd placówki i kto ma dostęp do informacji.
          </p>
        </Link>
      </main>
    </div>
  );
}
