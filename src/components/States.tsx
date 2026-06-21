import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '../lib/useTheme';

// Shown when accounts are enabled and the visitor isn't signed in.
export function AuthRequiredState() {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text, fontSize: 18 * fontScale }]}>
        Create a free account to start
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 15 * fontScale }]}>
        You get 10 free messages a month. It only takes a few seconds.
      </Text>
      <Link href="/account" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Sign in or sign up"
          style={({ pressed }) => [styles.btn, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 15 * fontScale }}>Sign in / Sign up</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// Shown when a free user hits their monthly limit.
export function LimitReachedState() {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text, fontSize: 18 * fontScale }]}>
        You’ve used your 10 free messages
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 15 * fontScale }]}>
        Upgrade to Pro for unlimited messages — $3.99/mo or $19.99/yr.
      </Text>
      <Link href="/account" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Upgrade to Pro"
          style={({ pressed }) => [styles.btn, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 15 * fontScale }}>Upgrade to Pro</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// Loading, empty, error, and "no strong match" states for the async search path.

export function LoadingState({ query }: { query: string }) {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityRole="text">
      <ActivityIndicator color={theme.accent} />
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 15 * fontScale }]}>
        Looking for verses about “{query}”…
      </Text>
    </View>
  );
}

export function NoMatchState({ onRetry }: { onRetry: () => void }) {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text, fontSize: 18 * fontScale }]}>
        No strong match, and that’s okay.
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 15 * fontScale }]}>
        Try rephrasing, or describe the feeling or situation in a few more words.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.btnText, { color: theme.accent, fontSize: 15 * fontScale }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.wrap} accessibilityLiveRegion="assertive">
      <Text style={[styles.title, { color: theme.danger, fontSize: 18 * fontScale }]}>
        Something went wrong
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 15 * fontScale }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.btnText, { color: theme.accent, fontSize: 15 * fontScale }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyHome() {
  const { theme, fontScale } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text, fontSize: 22 * fontScale }]}>
        What’s on your mind?
      </Text>
      <Text style={[styles.muted, { color: theme.textMuted, fontSize: 18 * fontScale, textAlign: 'center' }]}>
        Share a theme, a situation, or a feeling, like “forgiveness”, “I feel anxious”, or “starting
        over”, and find scripture that speaks to this moment.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  empty: { paddingVertical: 48, paddingHorizontal: 28, alignItems: 'center', gap: 14 },
  title: { fontWeight: '700', textAlign: 'center' },
  emptyTitle: { fontWeight: '700', textAlign: 'center' },
  muted: { textAlign: 'center', lineHeight: 22 },
  btn: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, minHeight: 44, justifyContent: 'center' },
  btnText: { fontWeight: '600' },
});
