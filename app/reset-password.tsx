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
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/useTheme';
import { useAuth } from '../src/store/useAuth';
import { supabaseConfigured, parseRecoveryHash, type RecoveryTokens } from '../src/lib/supabase';

const MIN_PASSWORD = 8;

// Landing page for the password-reset email link. GoTrue verifies the one-time
// token and redirects here with the recovery session in the URL hash; we read
// it, let the user pick a new password, then sign them in.
export default function ResetPassword() {
  const { theme, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const maxWidth = 560;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', paddingTop: insets.top + 20 }}>
      <View style={{ width: '100%', maxWidth, flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Link href="/account" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Back to account" hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          </Link>
          <Text style={[styles.title, { color: theme.text, fontSize: 20 * fontScale }]} accessibilityRole="header">
            Reset password
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {!supabaseConfigured ? (
            <Text style={{ color: theme.textMuted, fontSize: 15 * fontScale, lineHeight: 22 }}>
              Accounts aren’t configured yet.
            </Text>
          ) : (
            <ResetForm />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ResetForm() {
  const { theme, fontScale } = useTheme();
  const router = useRouter();
  const completePasswordReset = useAuth((s) => s.completePasswordReset);

  const [phase, setPhase] = useState<'checking' | 'form' | 'invalid'>('checking');
  const [recovery, setRecovery] = useState<RecoveryTokens | null>(null);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the recovery session from the URL hash once, then strip it from the
  // address bar so the tokens don't linger in history or get shared.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseRecoveryHash(window.location.hash);
    if (window.location.hash) window.history.replaceState({}, '', '/reset-password');
    if (parsed?.tokens) {
      setRecovery(parsed.tokens);
      setPhase('form');
    } else {
      setInvalidMsg(parsed?.error ?? null);
      setPhase('invalid');
    }
  }, []);

  const submit = async () => {
    setError(null);
    if (!recovery) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      await completePasswordReset(recovery, password);
      router.replace('/account');
    } catch (e: any) {
      setError(e?.message || 'Could not update your password. The link may have expired — request a new one.');
      setBusy(false);
    }
  };

  if (phase === 'checking') {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, alignItems: 'center' }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (phase === 'invalid') {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={{ color: theme.text, fontSize: 19 * fontScale, fontWeight: '700' }}>This link won’t work</Text>
        <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale, lineHeight: 20 }}>
          {invalidMsg
            ? `${invalidMsg}. Reset links expire after a while and can only be used once.`
            : 'This password-reset link is invalid or has expired. Reset links expire after a while and can only be used once.'}
        </Text>
        <Link href="/account" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Request a new reset link"
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 16 * fontScale }}>
              Request a new link
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 19 * fontScale, fontWeight: '700' }}>Choose a new password</Text>
      <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale, lineHeight: 20 }}>
        Pick a password with at least {MIN_PASSWORD} characters. You’ll be signed in right after.
      </Text>

      <Field label="New password" theme={theme} fontScale={fontScale}>
        <View style={[styles.pwRow, { borderColor: theme.border }]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder=""
            secureTextEntry={!showPw}
            autoComplete="new-password"
            style={[styles.pwInput, { color: theme.text, fontSize: 16 * fontScale }]}
            accessibilityLabel="New password"
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
      <Field label="Confirm new password" theme={theme} fontScale={fontScale}>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder=""
          secureTextEntry={!showPw}
          autoComplete="new-password"
          onSubmitEditing={submit}
          style={[styles.input, { color: theme.text, borderColor: theme.border, fontSize: 16 * fontScale }]}
          accessibilityLabel="Confirm new password"
        />
      </Field>

      {error && <Text style={{ color: theme.danger, fontSize: 14 * fontScale }}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Update password"
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: theme.accent, opacity: busy || pressed ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 16 * fontScale }}>Update password</Text>
        )}
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
});
