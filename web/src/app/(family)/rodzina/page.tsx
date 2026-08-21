export default function FamilyHomePage() {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <p className="text-base leading-relaxed text-slate-700">
        Tu pojawi się dzisiejsza relacja o bliskiej osobie — spokojnym językiem,
        bez liczb z opaski i bez szpitalnego słownictwa.
      </p>
      <div className="rounded-2xl border border-dashed border-teal-200 bg-white px-4 py-8 text-center">
        <p className="font-medium text-slate-900">Jeszcze nic z dzisiejszego dnia</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Gdy personel zapisze notatkę, zobaczysz ją w tym miejscu.
        </p>
      </div>
      <div className="rounded-2xl bg-slate-100 px-4 py-8 text-center">
        <p className="font-medium text-slate-900">
          Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Zostawiamy tu miejsce na przyszłe odczyty samopoczucia — bez alarmów
          i bez liczb z opaski.
        </p>
      </div>
    </section>
  );
}
