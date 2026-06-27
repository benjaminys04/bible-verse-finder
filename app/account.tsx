import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/useTheme';
import { useAuth } from '../src/store/useAuth';
import { supabaseConfigured, getMonthlyUsage } from '../src/lib/supabase';

const FREE_LIMIT = 10;

export default function Account() {
  const { theme, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAuth((s) => s.session);
  const maxWidth = 560;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', paddingTop: insets.top + 20 }}>
      <View style={{ width: '100%', maxWidth, flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Back to search" hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          </Link>
          <Text style={[styles.title, { color: theme.text, fontSize: 20 * fontScale }]} accessibilityRole="header">
            Account
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {!supabaseConfigured ? (
            <Text style={{ color: theme.textMuted, fontSize: 15 * fontScale, lineHeight: 22 }}>
              Accounts aren’t configured yet.
            </Text>
          ) : session ? (
            <Profile />
          ) : (
            <AuthForm />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function AuthForm() {
  const { theme, fontScale } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);

  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Enter your email.');
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(email);
        // Generic confirmation — never reveal whether the email is registered.
        setNotice('If an account exists for that email, a password-reset link is on its way. Check your inbox (and spam).');
      } catch (e: any) {
        setError(e?.message || 'Could not send the reset email. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email, password);
      } else {
        const { needsConfirm } = await signUp(email, password);
        if (needsConfirm) {
          setNotice('Account created. Check your email to confirm, then sign in.');
          setMode('in');
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Create your account' : 'Reset your password';
  const subtitle =
    mode === 'in'
      ? 'Sign in to save favorites and track your messages.'
      : mode === 'up'
        ? 'Free includes 10 messages a month. Upgrade anytime for unlimited.'
        : 'Enter your email and we’ll send you a link to set a new password.';
  const submitLabel = mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 19 * fontScale, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale, lineHeight: 20 }}>{subtitle}</Text>

      <Field label="Email" theme={theme} fontScale={fontScale}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder=""
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontSize: 16 * fontScale }]}
          accessibilityLabel="Email"
        />
      </Field>
      {mode !== 'forgot' && (
        <Field label="Password" theme={theme} fontScale={fontScale}>
          <View style={[styles.pwRow, { borderColor: theme.border }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder=""
              secureTextEntry={!showPw}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              onSubmitEditing={submit}
              style={[styles.pwInput, { color: theme.text, fontSize: 16 * fontScale }]}
              accessibilityLabel="Password"
            />
            <Pressable
              onPress={() => setShowPw((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
              hitSlop={8}
              style={styles.eyeBtn}
            >
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textMuted} />
            </Pressable>
          </View>
        </Field>
      )}

      {mode === 'in' && (
        <Pressable
          onPress={() => {
            setMode('forgot');
            setError(null);
            setNotice(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          style={{ alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.accent, fontSize: 13 * fontScale }}>Forgot password?</Text>
        </Pressable>
      )}

      {error && <Text style={{ color: theme.danger, fontSize: 14 * fontScale }}>{error}</Text>}
      {notice && <Text style={{ color: theme.accent, fontSize: 14 * fontScale }}>{notice}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: busy || pressed ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 16 * fontScale }}>{submitLabel}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(mode === 'in' ? 'up' : 'in');
          setError(null);
          setNotice(null);
        }}
        accessibilityRole="button"
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.accent, fontSize: 14 * fontScale }}>
          {mode === 'in'
            ? 'New here? Create an account'
            : mode === 'up'
              ? 'Already have an account? Sign in'
              : 'Back to sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

function Profile() {
  const { theme, fontScale } = useTheme();
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const getAccessToken = useAuth((s) => s.getAccessToken);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const params = useLocalSearchParams<{ upgraded?: string; canceled?: string; session_id?: string }>();

  const [usage, setUsage] = useState<number | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState<null | 'month' | 'year'>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';
  const isPro = profile?.plan === 'pro';
  const unlimited = isAdmin || isPro;

  useEffect(() => {
    let cancelled = false;
    if (session) getMonthlyUsage(session).then((n) => !cancelled && setUsage(n)).catch(() => setUsage(0));
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Confirm the upgrade when Stripe redirects back to /account?upgraded=1.
  useEffect(() => {
    if (params.canceled === '1') setBanner('Checkout canceled — no charge was made.');
    if (params.upgraded === '1' && params.session_id) {
      (async () => {
        const token = await getAccessToken();
        try {
          const res = await fetch(`/subscription-sync?session_id=${encodeURIComponent(String(params.session_id))}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (data.pro) {
            setBanner('You’re Pro! Unlimited messages unlocked.');
            await refreshProfile();
          } else if (data.pending) {
            setBanner('Payment is processing — refresh in a moment.');
          } else {
            setBanner(data.error || 'Could not confirm the upgrade.');
          }
        } catch {
          setBanner('Could not confirm the upgrade.');
        }
        if (typeof window !== 'undefined') window.history.replaceState({}, '', '/account');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCheckout = async (interval: 'month' | 'year') => {
    setBanner(null);
    setCheckoutBusy(interval);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/checkout?interval=${interval}`, { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
        return;
      }
      setBanner(data.error || 'Could not start checkout.');
    } catch {
      setBanner('Could not start checkout.');
    } finally {
      setCheckoutBusy(null);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {banner && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent, padding: 14 }]}>
          <Text style={{ color: theme.accent, fontSize: 14 * fontScale, fontWeight: '600' }}>{banner}</Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.textMuted, fontSize: 13 * fontScale }}>Signed in as</Text>
        <Text style={{ color: theme.text, fontSize: 18 * fontScale, fontWeight: '700' }}>{session?.user.email}</Text>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft, alignSelf: 'flex-start' }]}>
          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 * fontScale }}>
            {isAdmin ? 'Admin · Unlimited' : isPro ? 'Pro · Unlimited' : 'Free plan'}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.text, fontSize: 16 * fontScale, fontWeight: '700' }}>This month</Text>
        <Text style={{ color: theme.textMuted, fontSize: 15 * fontScale, lineHeight: 22 }}>
          {unlimited
            ? `${usage ?? '…'} messages — unlimited on your plan.`
            : `${usage ?? '…'} of ${FREE_LIMIT} free messages used.`}
        </Text>
        {!unlimited && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro, monthly"
              disabled={!!checkoutBusy}
              onPress={() => startCheckout('month')}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: checkoutBusy || pressed ? 0.7 : 1 }]}
            >
              {checkoutBusy === 'month' ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 15 * fontScale }}>
                  Upgrade to Pro — $3.99 / month
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro, yearly"
              disabled={!!checkoutBusy}
              onPress={() => startCheckout('year')}
              style={({ pressed }) => [styles.signOut, { borderColor: theme.accent, opacity: checkoutBusy || pressed ? 0.7 : 1 }]}
            >
              {checkoutBusy === 'year' ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 15 * fontScale }}>
                  Or $19.99 / year — save 58%
                </Text>
              )}
            </Pressable>
            <Text style={{ color: theme.textMuted, fontSize: 12 * fontScale, textAlign: 'center' }}>
              Unlimited messages. Cancel anytime.
            </Text>
          </>
        )}
      </View>

      {isAdmin && (
        <Link href="/admin" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open admin dashboard"
            style={({ pressed }) => [styles.signOut, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 15 * fontScale }}>Open admin dashboard</Text>
          </Pressable>
        </Link>
      )}

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [styles.signOut, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 15 * fontScale }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, theme, fontScale, children }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.textMuted, fontSize: 13 * fontScale, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingRight: 6 },
  pwInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  eyeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  signOut: { borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
});
