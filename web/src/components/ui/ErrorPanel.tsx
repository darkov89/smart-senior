export function ErrorPanel({
  title = "Nie udało się wczytać",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6"
    >
      <p className="font-medium text-red-950">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-red-900/80">{description}</p>
    </div>
  );
}
