import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/useTheme';
import { useStore } from '../store/useStore';
import { BUNDLED_TRANSLATIONS, type TranslationInfo } from '../lib/translations/shared';

// Translation picker. Shows the bundled public-domain translations immediately,
// then augments with any licensed ones the server reports from /translations.
export function TranslationPicker() {
  const { theme, fontScale } = useTheme();
  const translationId = useStore((s) => s.translationId);
  const setTranslation = useStore((s) => s.setTranslation);

  const [open, setOpen] = useState(false);
  const [list, setList] = useState<TranslationInfo[]>(BUNDLED_TRANSLATIONS);

  useEffect(() => {
    let cancelled = false;
    fetch('/translations')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.translations) && data.translations.length) {
          setList(data.translations);
        }
      })
      .catch(() => {
        /* keep bundled fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = list.find((t) => t.id === translationId) ?? BUNDLED_TRANSLATIONS[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Translation: ${current.name}. Change translation`}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.accentSoft, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="language-outline" size={15 * fontScale} color={theme.accent} />
        <Text style={[styles.triggerText, { color: theme.accent, fontSize: 13 * fontScale }]}>
          {current.abbreviation}
        </Text>
        <Ionicons name="chevron-down" size={13 * fontScale} color={theme.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(e) => (e as any).stopPropagation?.()}
          >
            <Text style={[styles.sheetTitle, { color: theme.text, fontSize: 17 * fontScale }]}>
              Choose a translation
            </Text>
            <ScrollView>
              {list.map((t) => {
                const selected = t.id === translationId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setTranslation(t.id);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${t.name}. ${t.license}`}
                    style={({ pressed }) => [
                      styles.row,
                      { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 16 * fontScale, fontWeight: '600' }}>
                        {t.name}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12 * fontScale }}>
                        {t.abbreviation} · {t.license}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22 * fontScale} color={theme.accent} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    minHeight: 36,
  },
  triggerText: { fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 18, borderWidth: 1, padding: 18, maxHeight: '70%', gap: 8 },
  sheetTitle: { fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, minHeight: 44 },
});
