import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../src/lib/useTheme';
import { useStore } from '../src/store/useStore';
import { useAuth } from '../src/store/useAuth';
import { supabaseConfigured } from '../src/lib/supabase';
import { searchVerses, type SearchResult, type ApiError } from '../src/lib/api';
import { ChatInput } from '../src/components/ChatInput';
import { VerseCard } from '../src/components/VerseCard';
import { TranslationPicker } from '../src/components/TranslationPicker';
import {
  LoadingState,
  ErrorState,
  NoMatchState,
  EmptyHome,
  AuthRequiredState,
  LimitReachedState,
} from '../src/components/States';

type Status = 'loading' | 'done' | 'error' | 'nomatch' | 'auth_required' | 'limit_reached';

interface Message {
  id: string;
  query: string;
  status: Status;
  results: SearchResult[];
  error?: string;
}

let counter = 0;
const nextId = () => `m${Date.now()}_${counter++}`;

export default function Home() {
  const { theme, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  // Constant max width + width:'100%' lets CSS handle the responsive cap.
  // (Do NOT derive this from useWindowDimensions: it returns 0 during SSR/
  // hydration, which would collapse the whole content column to zero width.)
  const maxWidth = 720;

  const translationId = useStore((s) => s.translationId);
  const history = useStore((s) => s.history);
  const addHistory = useStore((s) => s.addHistory);
  const clearHistory = useStore((s) => s.clearHistory);
  const themePref = useStore((s) => s.themePref);
  const setThemePref = useStore((s) => s.setThemePref);

  const getAccessToken = useAuth((s) => s.getAccessToken);

  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const runSearch = useCallback(
    async (query: string, messageId: string) => {
      setBusy(true);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'loading', error: undefined } : m)),
      );
      try {
        // When accounts are enabled, require a session and attach the token.
        const token = (await getAccessToken()) ?? undefined;
        if (supabaseConfigured && !token) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, status: 'auth_required' } : m)),
          );
          return;
        }
        const res = await searchVerses(query, translationId, token);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  status: res.noStrongMatch || res.results.length === 0 ? 'nomatch' : 'done',
                  results: res.results,
                }
              : m,
          ),
        );
      } catch (e) {
        const err = e as ApiError;
        const status: Status =
          err.code === 'limit_reached' ? 'limit_reached' : err.code === 'auth_required' ? 'auth_required' : 'error';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status, error: err.message || 'Please try again.' } : m,
          ),
        );
      } finally {
        setBusy(false);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
    },
    [translationId, getAccessToken],
  );

  const submit = useCallback(
    (query: string) => {
      addHistory(query);
      const id = nextId();
      setMessages((prev) => [...prev, { id, query, status: 'loading', results: [] }]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      runSearch(query, id);
    },
    [addHistory, runSearch],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 28 }}>
        <View style={{ width: '100%', maxWidth, flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.title, { color: theme.text, fontSize: 32 * fontScale }]}
                  accessibilityRole="header"
                >
                  Open Source Bible
                </Text>
              </View>
              <View style={styles.headerActions}>
                {/* Two explicit theme buttons: Light and Dark (no system/auto). */}
                <View style={[styles.themeToggle, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Pressable
                    onPress={() => setThemePref('light')}
                    accessibilityRole="button"
                    accessibilityLabel="Light mode"
                    accessibilityState={{ selected: themePref === 'light' }}
                    style={[styles.themeBtn, themePref === 'light' && { backgroundColor: theme.accentSoft }]}
                  >
                    <Ionicons name="sunny" size={18} color={themePref === 'light' ? theme.accent : theme.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => setThemePref('dark')}
                    accessibilityRole="button"
                    accessibilityLabel="Dark mode"
                    accessibilityState={{ selected: themePref === 'dark' }}
                    style={[styles.themeBtn, themePref === 'dark' && { backgroundColor: theme.accentSoft }]}
                  >
                    <Ionicons name="moon" size={17} color={themePref === 'dark' ? theme.accent : theme.textMuted} />
                  </Pressable>
                </View>
                <Link href="/favorites" asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel="Saved verses" hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="heart-outline" size={22} color={theme.textMuted} />
                  </Pressable>
                </Link>
                <Link href="/account" asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel="Account" hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="person-circle-outline" size={24} color={theme.textMuted} />
                  </Pressable>
                </Link>
              </View>
            </View>
            <View style={styles.quoteBlock}>
              <Text style={[styles.quote, { color: theme.text, fontSize: 16 * fontScale }]}>
                “The light shines in the darkness, and the darkness has not overcome it.”
              </Text>
              <Text style={[styles.quoteCite, { color: theme.textMuted, fontSize: 13 * fontScale }]}>
                John 1:5
              </Text>
            </View>
            <View style={styles.controlsRow}>
              <TranslationPicker />
            </View>
          </View>

          {/* Conversation */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && <EmptyHome />}

            {messages.map((m) => (
              <View key={m.id} style={{ marginBottom: 8 }}>
                {/* User query bubble */}
                <View style={styles.queryRow}>
                  <View style={[styles.queryBubble, { backgroundColor: theme.accent }]}>
                    <Text style={{ color: theme.accentText, fontSize: 15 * fontScale }}>{m.query}</Text>
                  </View>
                </View>

                {m.status === 'loading' && <LoadingState query={m.query} />}
                {m.status === 'error' && (
                  <ErrorState message={m.error || ''} onRetry={() => runSearch(m.query, m.id)} />
                )}
                {m.status === 'nomatch' && <NoMatchState onRetry={() => runSearch(m.query, m.id)} />}
                {m.status === 'auth_required' && <AuthRequiredState />}
                {m.status === 'limit_reached' && <LimitReachedState />}
                {m.status === 'done' && m.results.map((v, i) => <VerseCard key={`${m.id}-${i}`} verse={v} />)}
              </View>
            ))}

            {/* Recent searches */}
            {history.length > 0 && (
              <View style={styles.recents}>
                <View style={styles.recentsHead}>
                  <Text style={{ color: theme.textMuted, fontSize: 13 * fontScale, fontWeight: '700' }}>
                    Recent
                  </Text>
                  <Pressable onPress={clearHistory} accessibilityRole="button" accessibilityLabel="Clear recent searches">
                    <Text style={{ color: theme.accent, fontSize: 13 * fontScale }}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {history.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => submit(h)}
                      accessibilityRole="button"
                      accessibilityLabel={`Search again: ${h}`}
                      style={({ pressed }) => [
                        styles.chip,
                        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontSize: 13 * fontScale }} numberOfLines={1}>
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 32, backgroundColor: theme.bg }]}>
            <ChatInput onSubmit={submit} disabled={busy} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontWeight: '800' },
  quoteBlock: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 8 },
  quote: { fontStyle: 'italic', lineHeight: 22 },
  quoteCite: { fontWeight: '600', marginLeft: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  themeToggle: { flexDirection: 'row', borderRadius: 22, borderWidth: 1, padding: 3, gap: 2 },
  themeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  queryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  queryBubble: { maxWidth: '85%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 4 },
  recents: { marginTop: 8, gap: 10 },
  recentsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, maxWidth: 220, minHeight: 36, justifyContent: 'center' },
  inputBar: { paddingHorizontal: 16, paddingTop: 8 },
});
