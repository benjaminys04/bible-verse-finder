import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/useTheme';
import { useStore } from '../src/store/useStore';
import { VerseCard } from '../src/components/VerseCard';

export default function Favorites() {
  const { theme, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width, 720);
  const favorites = useStore((s) => s.favorites);

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
            Saved verses
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
          {favorites.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text, fontSize: 18 * fontScale }]}>
                No saved verses yet
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 15 * fontScale, textAlign: 'center', lineHeight: 22 }}>
                Tap the heart on any verse to keep it here for later.
              </Text>
              <Link href="/" asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ pressed }) => [styles.cta, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 15 * fontScale }}>
                    Find a verse
                  </Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            favorites.map((v, i) => <VerseCard key={`${v.translationId}-${v.citation}-${i}`} verse={v} />)
          )}
        </ScrollView>
      </View>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontWeight: '700' },
  cta: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, minHeight: 44, justifyContent: 'center' },
});
