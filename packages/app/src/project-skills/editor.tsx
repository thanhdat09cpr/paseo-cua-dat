import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AdaptiveModalSheet, type SheetHeader } from "@/components/adaptive-modal-sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EditingTextInput as TextInput } from "@/components/ui/text-input";
import type { ProjectSkill, SkillDraft } from "./model";
import { isValidProjectSkillName, projectSkillInstructions } from "./model";

export interface ProjectSkillEditorProps {
  skill: ProjectSkill | null;
  error?: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: SkillDraft) => void;
}

export function ProjectSkillEditor({
  skill,
  error,
  saving,
  onCancel,
  onSave,
}: ProjectSkillEditorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(skill?.directoryName ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [instructions, setInstructions] = useState(
    skill ? projectSkillInstructions(skill.content) : "",
  );
  const [submitted, setSubmitted] = useState(false);
  const nameError = !isValidProjectSkillName(name)
    ? t("settings.project.skills.validation.name")
    : null;
  const descriptionError =
    description.trim().length === 0 ? t("settings.project.skills.validation.description") : null;
  const instructionsError =
    instructions.trim().length === 0 ? t("settings.project.skills.validation.instructions") : null;
  const hasErrors = Boolean(nameError || descriptionError || instructionsError);

  const header = useMemo<SheetHeader>(
    () => ({
      title: skill
        ? t("settings.project.skills.editor.editTitle", { name: skill.name })
        : t("settings.project.skills.editor.newTitle"),
    }),
    [skill, t],
  );

  const handleSave = useCallback(() => {
    setSubmitted(true);
    if (hasErrors) return;
    onSave({ name, description, instructions });
  }, [description, hasErrors, instructions, name, onSave]);

  return (
    <AdaptiveModalSheet
      visible
      header={header}
      onClose={onCancel}
      testID="project-skill-editor"
      desktopMaxWidth={600}
    >
      {error ? (
        <Alert
          testID="project-skill-editor-error"
          variant="error"
          title={t("settings.project.skills.operationFailedTitle")}
          description={error}
        />
      ) : null}
      <View style={styles.section}>
        <Text style={styles.label}>{t("settings.project.skills.editor.name")}</Text>
        <TextInput
          testID="project-skill-name"
          accessibilityLabel={t("settings.project.skills.editor.nameAccessibility")}
          initialValue={name}
          onChangeText={setName}
          editable={!skill}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="review-guidelines"
          placeholderTextColor={styles.placeholder.color}
          style={[styles.input, skill ? styles.disabledInput : null]}
        />
        <Text style={styles.hint}>{t("settings.project.skills.editor.nameHint")}</Text>
        {submitted && nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("settings.project.skills.editor.description")}</Text>
        <TextInput
          testID="project-skill-description"
          accessibilityLabel={t("settings.project.skills.editor.descriptionAccessibility")}
          initialValue={description}
          onChangeText={setDescription}
          placeholder={t("settings.project.skills.editor.descriptionPlaceholder")}
          placeholderTextColor={styles.placeholder.color}
          style={styles.input}
        />
        {submitted && descriptionError ? (
          <Text style={styles.error}>{descriptionError}</Text>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>{t("settings.project.skills.editor.instructions")}</Text>
        <TextInput
          testID="project-skill-instructions"
          accessibilityLabel={t("settings.project.skills.editor.instructionsAccessibility")}
          initialValue={instructions}
          onChangeText={setInstructions}
          multiline
          textAlignVertical="top"
          placeholder={t("settings.project.skills.editor.instructionsPlaceholder")}
          placeholderTextColor={styles.placeholder.color}
          style={styles.multilineInput}
        />
        {submitted && instructionsError ? (
          <Text style={styles.error}>{instructionsError}</Text>
        ) : null}
      </View>
      <Text style={styles.scopeHint}>{t("settings.project.skills.editor.scopeHint")}</Text>
      <View style={styles.footer}>
        <Button onPress={onCancel} variant="ghost" size="md" disabled={saving}>
          {t("settings.project.actions.cancel")}
        </Button>
        <Button onPress={handleSave} variant="default" size="md" loading={saving}>
          {saving ? t("settings.project.skills.editor.saving") : t("settings.project.actions.save")}
        </Button>
      </View>
    </AdaptiveModalSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.spacing[2] },
  label: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
  hint: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  scopeHint: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
  input: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  multilineInput: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    minHeight: 180,
  },
  disabledInput: { opacity: theme.opacity[50] },
  placeholder: { color: theme.colors.foregroundMuted },
  error: { color: theme.colors.palette.red[300], fontSize: theme.fontSize.sm },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
}));
