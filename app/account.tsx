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
import { Link } from 'expo-router';
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

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
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

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 19 * fontScale, fontWeight: '700' }}>
        {mode === 'in' ? 'Welcome back' : 'Create your account'}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale, lineHeight: 20 }}>
        {mode === 'in'
          ? 'Sign in to save favorites and track your messages.'
          : 'Free includes 10 messages a month. Upgrade anytime for unlimited.'}
      </Text>

      <Field label="Email" theme={theme} fontScale={fontScale}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontSize: 16 * fontScale }]}
          accessibilityLabel="Email"
        />
      </Field>
      <Field label="Password" theme={theme} fontScale={fontScale}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontSize: 16 * fontScale }]}
          accessibilityLabel="Password"
        />
      </Field>

      {error && <Text style={{ color: theme.danger, fontSize: 14 * fontScale }}>{error}</Text>}
      {notice && <Text style={{ color: theme.accent, fontSize: 14 * fontScale }}>{notice}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={mode === 'in' ? 'Sign in' : 'Create account'}
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: busy || pressed ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 16 * fontScale }}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Text>
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
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
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
  const [usage, setUsage] = useState<number | null>(null);

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

  return (
    <View style={{ gap: 14 }}>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro"
            onPress={() => {}}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 15 * fontScale }}>
              Upgrade to Pro — $3.99/mo
            </Text>
          </Pressable>
        )}
        {!unlimited && (
          <Text style={{ color: theme.textMuted, fontSize: 12 * fontScale, textAlign: 'center' }}>
            Unlimited messages. Cancel anytime.
          </Text>
        )}
      </View>

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
  primaryBtn: { borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  signOut: { borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
});
