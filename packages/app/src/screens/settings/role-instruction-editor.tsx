import { ChevronDown, ChevronRight, LockKeyhole } from "lucide-react-native";
import { composeRoleInstructionBase } from "@getpaseo/protocol/role-profile";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";

import { FormTextInput } from "@/components/ui/form-field";
import type { Theme } from "@/styles/theme";

const MAX_CUSTOM_INSTRUCTION_CHARS = 16_384;
const ThemedChevronDown = withUnistyles(ChevronDown);
const ThemedChevronRight = withUnistyles(ChevronRight);
const ThemedLockKeyhole = withUnistyles(LockKeyhole);
const mutedIconMapping = (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
});

function InstructionDisclosure({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const handlePress = useCallback(() => setExpanded((current) => !current), []);
  const accessibilityState = useMemo(() => ({ expanded }), [expanded]);

  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={handlePress}
        style={styles.disclosureHeader}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        testID={`${testID}-toggle`}
      >
        <View style={styles.disclosureTitle}>
          {expanded ? (
            <ThemedChevronDown size={16} uniProps={mutedIconMapping} />
          ) : (
            <ThemedChevronRight size={16} uniProps={mutedIconMapping} />
          )}
          <Text style={styles.title}>{title}</Text>
        </View>
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

function InstructionText({ text, testID }: { text: string; testID: string }) {
  return (
    <ScrollView
      style={styles.instructionScroll}
      contentContainerStyle={styles.instructionContent}
      nestedScrollEnabled
      testID={testID}
    >
      <Text selectable style={styles.instructionText}>
        {text}
      </Text>
    </ScrollView>
  );
}

export function RoleInstructionEditor({
  foundationInstructions,
  customInstructions,
  savedCustomInstructions,
  editable,
  onChangeCustomInstructions,
  roleId,
}: {
  foundationInstructions: string;
  customInstructions: string;
  savedCustomInstructions: string;
  editable: boolean;
  onChangeCustomInstructions: (value: string) => void;
  roleId: string;
}) {
  const effectivePreview = useMemo(() => {
    const custom = customInstructions.trim();
    return composeRoleInstructionBase(foundationInstructions, custom || undefined);
  }, [customInstructions, foundationInstructions]);

  return (
    <View style={styles.container} testID={`role-instructions-${roleId}`}>
      <View style={styles.headingRow}>
        <ThemedLockKeyhole size={15} uniProps={mutedIconMapping} />
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Role instructions</Text>
          <Text style={styles.hint}>
            Foundation stays read only. Human additions apply only to agents created after save.
          </Text>
        </View>
      </View>

      <InstructionDisclosure
        title="Foundation instructions · read only"
        testID={`foundation-${roleId}`}
      >
        <InstructionText text={foundationInstructions} testID={`foundation-${roleId}-content`} />
      </InstructionDisclosure>

      <View style={styles.customBlock}>
        <View style={styles.customTitleRow}>
          <Text style={styles.title}>Human custom instructions</Text>
          <Text style={styles.counter}>
            {customInstructions.length}/{MAX_CUSTOM_INSTRUCTION_CHARS}
          </Text>
        </View>
        <FormTextInput
          initialValue={savedCustomInstructions}
          resetKey={`${roleId}:${savedCustomInstructions}`}
          onChangeText={onChangeCustomInstructions}
          editable={editable}
          multiline
          maxLength={MAX_CUSTOM_INSTRUCTION_CHARS}
          textAlignVertical="top"
          placeholder={
            editable
              ? "Add role-specific guidance without editing Foundation…"
              : "Update the daemon to edit Human role instructions."
          }
          style={styles.customInput}
          testID={`role-instructions-${roleId}-custom`}
        />
        <Text style={styles.hint}>
          Tool, skill, topology, mutation, and external-effect authority still comes from SLP.
        </Text>
      </View>

      <InstructionDisclosure
        title="Effective role base for new agents"
        testID={`effective-${roleId}`}
      >
        <InstructionText text={effectivePreview} testID={`effective-${roleId}-content`} />
      </InstructionDisclosure>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[4],
    gap: theme.spacing[3],
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[2],
  },
  headingCopy: { flex: 1 },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  hint: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    lineHeight: 18,
  },
  disclosure: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
  },
  disclosureHeader: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: theme.spacing[3],
  },
  disclosureTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  instructionScroll: {
    maxHeight: 260,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  instructionContent: { padding: theme.spacing[3] },
  instructionText: {
    color: theme.colors.foregroundMuted,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
    lineHeight: 18,
  },
  customBlock: { gap: theme.spacing[2] },
  customTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  counter: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  customInput: {
    minHeight: 160,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
  },
}));
