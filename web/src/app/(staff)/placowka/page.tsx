export default function FacilityOverviewPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Dzisiejszy podgląd
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          Tu personel zobaczy, co już zapisano i co jeszcze czeka na relację.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
        <p className="font-medium text-slate-900">Brak zapisów na dziś</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Gdy pojawią się notatki z dyżuru, ułożymy je na tej liście.
        </p>
      </div>
    </section>
  );
}
