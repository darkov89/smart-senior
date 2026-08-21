export function PageSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <p className="sr-only">Chwila, przygotowujemy widok…</p>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-200" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl bg-slate-200/80"
        />
      ))}
    </div>
  );
}
