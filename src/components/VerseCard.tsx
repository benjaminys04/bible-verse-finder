import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../lib/useTheme';
import { useStore } from '../store/useStore';
import { fetchContext, type SearchResult, type ContextResponse } from '../lib/api';

// A single grounded result: large verse text, citation, the one-line reason,
// copy / share / save actions, and tap-to-expand surrounding context.
export function VerseCard({ verse }: { verse: SearchResult }) {
  const { theme, fontScale } = useTheme();
  const isFav = useStore((s) => s.isFavorite(verse.citation, verse.translationId));
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ctx, setCtx] = useState<ContextResponse | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxError, setCtxError] = useState<string | null>(null);

  const shareText = `“${verse.text}”\n${verse.citation} (${verse.translationName})`;

  const onCopy = useCallback(async () => {
    await Clipboard.setStringAsync(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [shareText]);

  const onShare = useCallback(async () => {
    try {
      // Web Share API where available (mobile browsers / some desktops),
      // otherwise fall back to copying to the clipboard.
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ text: shareText });
      } else {
        await onCopy();
      }
    } catch {
      // user cancelled or share unsupported — fall back to copy
      await onCopy();
    }
  }, [shareText, onCopy]);

  const onToggleContext = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !ctx && !ctxLoading) {
      setCtxLoading(true);
      setCtxError(null);
      try {
        const data = await fetchContext({
          translationId: verse.translationId,
          book: verse.book,
          chapter: verse.chapter,
          verseStart: verse.verseStart,
          verseEnd: verse.verseEnd,
        });
        setCtx(data);
      } catch (e: any) {
        setCtxError(e?.message || 'Could not load context.');
      } finally {
        setCtxLoading(false);
      }
    }
  }, [expanded, ctx, ctxLoading, verse]);

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
      accessibilityRole="summary"
    >
      <Text
        style={[styles.verseText, { color: theme.text, fontSize: 19 * fontScale, lineHeight: 28 * fontScale }]}
        accessibilityLabel={`${verse.citation}. ${verse.text}`}
      >
        {verse.text}
      </Text>

      <Text style={[styles.citation, { color: theme.accent, fontSize: 15 * fontScale }]}>
        {verse.citation}
        <Text style={{ color: theme.textMuted }}>  ·  {verse.translationName}</Text>
      </Text>

      <View style={[styles.reasonRow, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="sparkles-outline" size={15 * fontScale} color={theme.textMuted} />
        <Text style={[styles.reason, { color: theme.textMuted, fontSize: 14 * fontScale }]}>{verse.reason}</Text>
      </View>

      <View style={styles.actions}>
        <ActionButton
          icon={isFav ? 'heart' : 'heart-outline'}
          label={isFav ? 'Saved' : 'Save'}
          active={isFav}
          onPress={() => toggleFavorite(verse)}
          a11y={isFav ? `Remove ${verse.citation} from saved` : `Save ${verse.citation}`}
        />
        <ActionButton
          icon={copied ? 'checkmark' : 'copy-outline'}
          label={copied ? 'Copied' : 'Copy'}
          onPress={onCopy}
          a11y={`Copy ${verse.citation}`}
        />
        <ActionButton icon="share-outline" label="Share" onPress={onShare} a11y={`Share ${verse.citation}`} />
        <ActionButton
          icon={expanded ? 'chevron-up' : 'book-outline'}
          label="Context"
          onPress={onToggleContext}
          a11y={expanded ? 'Hide surrounding verses' : 'Show surrounding verses'}
        />
      </View>

      {expanded && (
        <View style={[styles.context, { borderTopColor: theme.border }]} accessibilityLiveRegion="polite">
          {ctxLoading && <ActivityIndicator color={theme.accent} />}
          {ctxError && (
            <Text style={[styles.reason, { color: theme.danger, fontSize: 14 * fontScale }]}>{ctxError}</Text>
          )}
          {ctx && (
            <>
              <Text style={[styles.contextRef, { color: theme.textMuted, fontSize: 13 * fontScale }]}>
                {ctx.reference} · {ctx.translationName}
              </Text>
              <Text style={{ fontSize: 16 * fontScale, lineHeight: 26 * fontScale, color: theme.text }}>
                {ctx.verses.map((v) => (
                  <Text
                    key={v.verse}
                    style={
                      v.highlighted
                        ? { backgroundColor: theme.highlight, color: theme.text, fontWeight: '600' }
                        : { color: theme.textMuted }
                    }
                  >
                    <Text style={{ color: theme.accent, fontSize: 11 * fontScale }}>{v.verse} </Text>
                    {v.text}{' '}
                  </Text>
                ))}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  active,
  a11y,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  active?: boolean;
  a11y: string;
}) {
  const { theme, fontScale } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={19 * fontScale} color={active ? theme.accent : theme.textMuted} />
      <Text style={[styles.actionLabel, { color: active ? theme.accent : theme.textMuted, fontSize: 12 * fontScale }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  verseText: { fontWeight: '500' },
  citation: { fontWeight: '700' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  reason: { flex: 1, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  actionLabel: { fontWeight: '600' },
  context: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  contextRef: { fontWeight: '600' },
});
