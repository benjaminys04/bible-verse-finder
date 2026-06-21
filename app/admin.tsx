import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/useTheme';
import { useAuth } from '../src/store/useAuth';
import type { AdminStats } from '../src/lib/supabaseAdmin'; // type-only: not bundled

type Phase = 'loading' | 'ok' | 'signin' | 'unauth' | 'error';

export default function Admin() {
  const { theme, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const getAccessToken = useAuth((s) => s.getAccessToken);
  const maxWidth = 720;

  const [phase, setPhase] = useState<Phase>('loading');
  const [stats, setStats] = useState<AdminStats | null>(null);

  const load = async () => {
    setPhase('loading');
    const token = await getAccessToken();
    if (!token) {
      setPhase('signin');
      return;
    }
    try {
      const res = await fetch('/admin-stats', { headers: { authorization: `Bearer ${token}` } });
      if (res.status === 403) return setPhase('unauth');
      if (!res.ok) return setPhase('error');
      setStats(await res.json());
      setPhase('ok');
    } catch {
      setPhase('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', paddingTop: insets.top + 20 }}>
      <View style={{ width: '100%', maxWidth, flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Back" hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          </Link>
          <Text style={[styles.title, { color: theme.text, fontSize: 20 * fontScale }]} accessibilityRole="header">
            Admin dashboard
          </Text>
          <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Refresh" hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="refresh" size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
          {phase === 'loading' && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}
          {phase === 'signin' && <Notice text="Sign in with the admin account to view this page." theme={theme} fontScale={fontScale} cta />}
          {phase === 'unauth' && <Notice text="This account doesn’t have admin access." theme={theme} fontScale={fontScale} />}
          {phase === 'error' && <Notice text="Couldn’t load stats. Try refreshing." theme={theme} fontScale={fontScale} />}

          {phase === 'ok' && stats && (
            <>
              <View style={styles.grid}>
                <Stat label="Accounts" value={stats.totalAccounts} theme={theme} fontScale={fontScale} />
                <Stat label="Active this month" value={stats.activeThisMonth} theme={theme} fontScale={fontScale} />
                <Stat label="Have logged in" value={stats.loggedInEver} theme={theme} fontScale={fontScale} />
                <Stat label="Pro subscribers" value={stats.proSubscribers} theme={theme} fontScale={fontScale} />
                <Stat label="Messages this month" value={stats.messagesThisMonth} theme={theme} fontScale={fontScale} />
                <Stat label="Messages all-time" value={stats.messagesAllTime} theme={theme} fontScale={fontScale} />
                <Stat
                  label="Page views"
                  value={stats.pageViews ?? '—'}
                  theme={theme}
                  fontScale={fontScale}
                  hint={stats.pageViews == null ? 'run phase4 SQL' : undefined}
                />
              </View>

              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.text, fontSize: 16 * fontScale, fontWeight: '700' }}>Top users this month</Text>
                {stats.topUsers.length === 0 ? (
                  <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale }}>No messages yet.</Text>
                ) : (
                  stats.topUsers.map((u, i) => (
                    <View key={u.email + i} style={[styles.row, { borderTopColor: theme.border }]}>
                      <Text style={{ color: theme.text, fontSize: 14 * fontScale, flex: 1 }} numberOfLines={1}>
                        {u.email}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale, fontWeight: '700' }}>
                        {u.messages}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.text, fontSize: 16 * fontScale, fontWeight: '700' }}>Payments</Text>
                <View style={styles.payRow}>
                  <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale }}>Estimated MRR</Text>
                  <Text style={{ color: theme.text, fontSize: 18 * fontScale, fontWeight: '800' }}>
                    ${(stats.estMrrCents / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.payRow}>
                  <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale }}>Monthly subscribers</Text>
                  <Text style={{ color: theme.text, fontSize: 14 * fontScale, fontWeight: '700' }}>{stats.monthlySubs}</Text>
                </View>
                <View style={styles.payRow}>
                  <Text style={{ color: theme.textMuted, fontSize: 14 * fontScale }}>Yearly subscribers</Text>
                  <Text style={{ color: theme.text, fontSize: 14 * fontScale, fontWeight: '700' }}>{stats.yearlySubs}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Stat({ label, value, theme, fontScale, hint }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 28 * fontScale, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 13 * fontScale }}>{label}</Text>
      {hint && <Text style={{ color: theme.accent, fontSize: 11 * fontScale }}>{hint}</Text>}
    </View>
  );
}

function Notice({ text, theme, fontScale, cta }: any) {
  return (
    <View style={{ gap: 12, paddingTop: 24, alignItems: 'center' }}>
      <Text style={{ color: theme.textMuted, fontSize: 15 * fontScale, textAlign: 'center', lineHeight: 22 }}>{text}</Text>
      {cta && (
        <Link href="/account" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.cta, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: theme.accentText, fontWeight: '700', fontSize: 15 * fontScale }}>Go to sign in</Text>
          </Pressable>
        </Link>
      )}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flexGrow: 1, flexBasis: 150, borderRadius: 14, borderWidth: 1, padding: 16, gap: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, gap: 10 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { borderRadius: 12, minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
