export default async function FamilyPersonPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  await params;

  return (
    <section className="flex flex-1 flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Relacja z dnia</h2>
      <p className="text-base leading-relaxed text-slate-700">
        Tu będzie krótki list od personelu — jak minął dzień, nastrój i aktywność.
        Spokojna relacja: samopoczucie, sen i regeneracja.
      </p>
      <div className="rounded-2xl border border-dashed border-teal-200 bg-white px-4 py-8 text-center">
        <p className="font-medium text-slate-900">Brak zapisu na dziś</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Jak tylko pojawi się zatwierdzona relacja, pokażemy ją tutaj.
        </p>
      </div>
      <div className="rounded-2xl bg-slate-100 px-4 py-8 text-center">
        <p className="font-medium text-slate-900">
          Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Plan dnia i relacja od personelu są niezależne od opaski.
        </p>
      </div>
    </section>
  );
}
