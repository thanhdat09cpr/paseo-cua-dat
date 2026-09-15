import { ChevronDown, ChevronRight, LockKeyhole } from "lucide-react-native";
import { composeRoleInstructionBase } from "@getpaseo/protocol/role-profile";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";

import { AdaptiveModalSheet, type SheetHeader } from "@/components/adaptive-modal-sheet";
import { FormTextInput } from "@/components/ui/form-field";
import type { EditingTextInputHandle } from "@/components/ui/text-input";
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const inlineInputRef = useRef<EditingTextInputHandle | null>(null);
  const expandedInputRef = useRef<EditingTextInputHandle | null>(null);
  const effectivePreview = useMemo(() => {
    const custom = customInstructions.trim();
    return composeRoleInstructionBase(foundationInstructions, custom || undefined);
  }, [customInstructions, foundationInstructions]);
  const reviewHeader = useMemo<SheetHeader>(
    () => ({ title: `Human custom instructions · ${roleId}` }),
    [roleId],
  );
  const handleOpenReview = useCallback(() => setReviewOpen(true), []);
  const handleCloseReview = useCallback(() => setReviewOpen(false), []);
  const syncEditorValues = useCallback((value: string) => {
    if (inlineInputRef.current?.getText() !== value) {
      inlineInputRef.current?.replaceText(value);
    }
    if (expandedInputRef.current?.getText() !== value) {
      expandedInputRef.current?.replaceText(value);
    }
  }, []);
  const handleCustomInstructionsChange = useCallback(
    (value: string) => {
      onChangeCustomInstructions(value);
      syncEditorValues(value);
    },
    [onChangeCustomInstructions, syncEditorValues],
  );
  useEffect(() => syncEditorValues(customInstructions), [customInstructions, syncEditorValues]);

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
          <View style={styles.customTitleActions}>
            <Text style={styles.counter}>
              {customInstructions.length}/{MAX_CUSTOM_INSTRUCTION_CHARS}
            </Text>
            <Pressable
              onPress={handleOpenReview}
              accessibilityRole="button"
              accessibilityLabel="Open Human custom instructions in a larger editor"
              testID={`role-instructions-${roleId}-expand`}
            >
              <Text style={styles.expandAction}>Open full editor</Text>
            </Pressable>
          </View>
        </View>
        <FormTextInput
          ref={inlineInputRef}
          initialValue={savedCustomInstructions}
          resetKey={`${roleId}:${savedCustomInstructions}`}
          onChangeText={handleCustomInstructionsChange}
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

      <AdaptiveModalSheet
        header={reviewHeader}
        visible={reviewOpen}
        onClose={handleCloseReview}
        snapPoints={["90%"]}
        desktopMaxWidth={760}
        testID={`role-instructions-${roleId}-editor-sheet`}
      >
        <View style={styles.reviewBody}>
          <Text style={styles.hint}>
            Review the full draft here. Foundation remains read only; changes still apply only to
            agents created after save.
          </Text>
          <FormTextInput
            ref={expandedInputRef}
            initialValue={customInstructions}
            resetKey={`${roleId}:${reviewOpen ? "open" : "closed"}`}
            onChangeText={handleCustomInstructionsChange}
            editable={editable}
            multiline
            maxLength={MAX_CUSTOM_INSTRUCTION_CHARS}
            textAlignVertical="top"
            placeholder={
              editable
                ? "Add role-specific guidance without editing Foundation…"
                : "Update the daemon to edit Human role instructions."
            }
            style={styles.reviewInput}
            testID={`role-instructions-${roleId}-expanded-custom`}
          />
          <Text style={styles.counter}>
            {customInstructions.length}/{MAX_CUSTOM_INSTRUCTION_CHARS}
          </Text>
        </View>
      </AdaptiveModalSheet>
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
  customTitleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
  },
  counter: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  expandAction: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  customInput: {
    minHeight: 160,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
  },
  reviewBody: { gap: theme.spacing[3], minHeight: 520 },
  reviewInput: {
    flex: 1,
    minHeight: 440,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
}));
