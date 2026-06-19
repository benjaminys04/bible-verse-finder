import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/useTheme';

// The single prominent chat-style input. Submits on the send button or Enter.
export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const { theme, fontScale } = useTheme();
  const [value, setValue] = useState('');

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSubmit(t);
    setValue('');
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder="What’s on your mind?"
        placeholderTextColor={theme.textMuted}
        returnKeyType="search"
        accessibilityLabel="Search for verses about what's on your mind"
        style={[styles.input, { color: theme.text, fontSize: 16 * fontScale }]}
        editable={!disabled}
        multiline={false}
      />
      <Pressable
        onPress={submit}
        disabled={disabled || !value.trim()}
        accessibilityRole="button"
        accessibilityLabel="Find verses"
        style={({ pressed }) => [
          styles.send,
          {
            backgroundColor: value.trim() && !disabled ? theme.accent : theme.accentSoft,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name="arrow-up"
          size={20 * fontScale}
          color={value.trim() && !disabled ? theme.accentText : theme.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 26,
    paddingLeft: 24,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 10, paddingLeft: 4, minHeight: 44 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
