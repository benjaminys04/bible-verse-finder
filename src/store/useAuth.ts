import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as sb from '../lib/supabase';

interface AuthState {
  session: sb.Session | null;
  profile: sb.Profile | null;
  hydrated: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;

  requestPasswordReset: (email: string) => Promise<void>;
  // Set a new password from a recovery link, then sign the user in.
  completePasswordReset: (recovery: sb.RecoveryTokens, password: string) => Promise<void>;

  // A valid access token (refreshed if it's about to expire), or null if signed out.
  getAccessToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  _setHydrated: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      hydrated: false,

      signIn: async (email, password) => {
        const session = await sb.signIn(email.trim(), password);
        set({ session });
        void sb.touchLastSeen(session);
        set({ profile: await sb.getProfile(session).catch(() => null) });
      },

      signUp: async (email, password) => {
        const { session, needsConfirm } = await sb.signUp(email.trim(), password);
        if (session) {
          set({ session });
          set({ profile: await sb.getProfile(session).catch(() => null) });
        }
        return { needsConfirm };
      },

      signOut: async () => {
        const s = get().session;
        if (s) await sb.signOut(s.access_token);
        set({ session: null, profile: null });
      },

      requestPasswordReset: async (email) => {
        await sb.requestPasswordReset(email.trim());
      },

      completePasswordReset: async (recovery, password) => {
        const session = await sb.updatePassword(recovery, password);
        set({ session });
        void sb.touchLastSeen(session);
        set({ profile: await sb.getProfile(session).catch(() => null) });
      },

      getAccessToken: async () => {
        let s = get().session;
        if (!s) return null;
        if (s.expires_at < Math.floor(Date.now() / 1000) + 60) {
          try {
            s = await sb.refreshSession(s.refresh_token);
            set({ session: s });
          } catch {
            set({ session: null, profile: null });
            return null;
          }
        }
        return s.access_token;
      },

      refreshProfile: async () => {
        const s = get().session;
        if (!s) return;
        set({ profile: await sb.getProfile(s).catch(() => null) });
      },

      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'osb-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ session: s.session, profile: s.profile }),
      onRehydrateStorage: () => (state) => state?._setHydrated(),
    },
  ),
);
