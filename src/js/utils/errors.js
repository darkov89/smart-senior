/**
 * Bezpieczne komunikaty błędów dla UI.
 * Nie przekazujemy raw error.message / szczegółów PostgREST / stacków do użytkownika.
 */

const AUTH_ERROR_FALLBACK =
  'Nie udało się zalogować. Sprawdź e-mail i hasło lub spróbuj ponownie.';

/** Kody Auth Supabase → komunikat przyjazny (bez wycieku szczegółów infrastruktury). */
const AUTH_CODE_MESSAGES = {
  invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
  email_not_confirmed: 'Potwierdź adres e-mail przed logowaniem.',
  user_not_found: 'Nieprawidłowy e-mail lub hasło.',
  too_many_requests: 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
};

/**
 * @param {unknown} error
 * @returns {string}
 */
export function toSafeAuthErrorMessage(error) {
  if (!error || typeof error !== 'object') {
    return AUTH_ERROR_FALLBACK;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (code && AUTH_CODE_MESSAGES[code]) {
    return AUTH_CODE_MESSAGES[code];
  }

  const status = 'status' in error ? error.status : null;
  if (status === 400 || status === 401) {
    return AUTH_CODE_MESSAGES.invalid_credentials;
  }

  return AUTH_ERROR_FALLBACK;
}

/**
 * Log diagnostyczny wyłącznie w konsoli deweloperskiej (nie w UI).
 * @param {string} context
 * @param {unknown} error
 */
export function logClientError(context, error) {
  console.error(`[Pakiet Spokoju] ${context}`, error);
}
