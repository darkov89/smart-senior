export default function FacilityPermissionsPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Uprawnienia</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          Kto z personelu i z rodzin może widzieć informacje o pensjonariuszach.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
        <p className="font-medium text-slate-900">Lista dostępów jest pusta</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Zaproszenia i role podepniemy, gdy konto administratora placówki będzie gotowe.
        </p>
      </div>
    </section>
  );
}
