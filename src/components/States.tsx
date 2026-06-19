import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../lib/useTheme';

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
