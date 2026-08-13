/**
 * Alpine.store('auth') — sesja użytkownika + profil tenantowy (role, organization_id).
 *
 * Frontend tylko trzyma stan UI; autoryzację i izolację tenantów egzekwuje
 * Supabase Auth + RLS. Brak logiki medycznej / Guardrails w przeglądarce.
 */

import { supabase } from '../services/supabaseClient.js';
import { logClientError, toSafeAuthErrorMessage } from '../utils/errors.js';

/**
 * @typedef {object} AuthUserSnapshot
 * @property {string} id
 * @property {string} [email]
 */

/**
 * Rejestracja store przed startem Alpine (nasłuch alpine:init w main.js).
 */
export function registerAuthStore() {
  Alpine.store('auth', {
    /** @type {AuthUserSnapshot | null} */
    user: null,
    /** @type {string | null} app_role */
    role: null,
    /** @type {string | null} */
    organizationId: null,
    /** @type {string} */
    fullName: '',
    /** Pierwsze sprawdzenie sesji w toku */
    loading: true,
    /** Bezpieczny komunikat dla UI (bez szczegółów DB) */
    errorMessage: '',
    /** Flaga operacji login/logout */
    busy: false,

    get isAuthenticated() {
      return Boolean(this.user);
    },

    /**
     * @param {string} email
     * @param {string} password
     * @returns {Promise<boolean>}
     */
    async login(email, password) {
      this.errorMessage = '';
      this.busy = true;

      try {
        const trimmedEmail = String(email || '').trim();
        const plainPassword = String(password || '');

        if (!trimmedEmail || !plainPassword) {
          this.errorMessage = 'Podaj e-mail i hasło.';
          return false;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: plainPassword,
        });

        if (error) {
          logClientError('auth.login', error);
          this.errorMessage = toSafeAuthErrorMessage(error);
          return false;
        }

        await this.applySession(data.session);
        return true;
      } catch (error) {
        logClientError('auth.login.unexpected', error);
        this.errorMessage = toSafeAuthErrorMessage(error);
        return false;
      } finally {
        this.busy = false;
      }
    },

    /**
     * @returns {Promise<void>}
     */
    async logout() {
      this.errorMessage = '';
      this.busy = true;

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          logClientError('auth.logout', error);
          this.errorMessage =
            'Nie udało się wylogować. Odśwież stronę i spróbuj ponownie.';
          return;
        }
        this.clearSession();
      } catch (error) {
        logClientError('auth.logout.unexpected', error);
        this.errorMessage =
          'Nie udało się wylogować. Odśwież stronę i spróbuj ponownie.';
      } finally {
        this.busy = false;
      }
    },

    /**
     * Bootstrap: bieżąca sesja + subskrypcja zmian Auth.
     * @returns {Promise<void>}
     */
    async init() {
      this.loading = true;
      this.errorMessage = '';

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          logClientError('auth.getSession', error);
          this.clearSession();
        } else {
          await this.applySession(data.session);
        }

        // setTimeout: unikamy deadlocka Auth↔PostgREST przy await w callbacku.
        supabase.auth.onAuthStateChange((event, session) => {
          setTimeout(() => {
            void (async () => {
              try {
                if (event === 'SIGNED_OUT') {
                  this.clearSession();
                  return;
                }
                await this.applySession(session);
              } catch (listenerError) {
                logClientError('auth.onAuthStateChange', listenerError);
                this.clearSession();
              }
            })();
          }, 0);
        });
      } catch (error) {
        logClientError('auth.init', error);
        this.clearSession();
      } finally {
        this.loading = false;
      }
    },

    /**
     * @param {import('@supabase/supabase-js').Session | null | undefined} session
     */
    async applySession(session) {
      if (!session?.user) {
        this.clearSession();
        return;
      }

      this.user = {
        id: session.user.id,
        email: session.user.email ?? undefined,
      };

      await this.loadProfile(session.user.id);
    },

    /**
     * Profil z tabeli profiles (role, organization_id) — pod RLS.
     * @param {string} userId
     */
    async loadProfile(userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, organization_id, full_name')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          logClientError('auth.loadProfile', error);
          this.role = null;
          this.organizationId = null;
          this.fullName = '';
          return;
        }

        this.role = data?.role ?? null;
        this.organizationId = data?.organization_id ?? null;
        this.fullName = data?.full_name ?? '';
      } catch (error) {
        logClientError('auth.loadProfile.unexpected', error);
        this.role = null;
        this.organizationId = null;
        this.fullName = '';
      }
    },

    clearSession() {
      this.user = null;
      this.role = null;
      this.organizationId = null;
      this.fullName = '';
    },
  });
}
