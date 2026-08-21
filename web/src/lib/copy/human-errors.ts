export function humanAuthError(message: string | undefined): string {
  const lower = (message ?? "").toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Nie udało się zalogować. Sprawdź e-mail i hasło.";
  }
  if (lower.includes("email not confirmed")) {
    return "To konto czeka na potwierdzenie. Sprawdź skrzynkę albo poproś placówkę o pomoc.";
  }
  if (lower.includes("too many")) {
    return "Za dużo prób. Poczekaj chwilę i spróbuj ponownie.";
  }
  if (lower.includes("mfa") || lower.includes("factor") || lower.includes("challenge")) {
    return "Nie udało się potwierdzić kodu. Sprawdź aplikację i spróbuj ponownie.";
  }
  return "Nie udało się dokończyć. Spróbuj ponownie za chwilę.";
}

export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate");
}
