import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileCode2, Pencil, Trash2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { settingsStyles } from "@/styles/settings";
import type { ProjectSkill } from "./model";

const ThemedFileCode = withUnistyles(FileCode2);
const ThemedAlertTriangle = withUnistyles(AlertTriangle);
const ThemedPencil = withUnistyles(Pencil);
const ThemedTrash = withUnistyles(Trash2);

export function ProjectSkillRow({
  skill,
  first,
  onEdit,
  onRemove,
}: {
  skill: ProjectSkill;
  first: boolean;
  onEdit: (skill: ProjectSkill) => void;
  onRemove: (skill: ProjectSkill) => void;
}) {
  const { t } = useTranslation();
  const edit = useCallback(() => onEdit(skill), [onEdit, skill]);
  const remove = useCallback(() => onRemove(skill), [onRemove, skill]);
  return (
    <View
      style={[styles.skillRow, first ? null : styles.skillRowBorder]}
      testID={`project-skill-${skill.directoryName}`}
    >
      <Pressable style={styles.skillMain} onPress={edit} accessibilityRole="button">
        <View style={styles.skillTitleRow}>
          {skill.valid ? (
            <ThemedFileCode size={16} color={styles.muted.color} />
          ) : (
            <ThemedAlertTriangle size={16} color={styles.warning.color} />
          )}
          <Text style={settingsStyles.rowTitle} numberOfLines={1}>
            {skill.name}
          </Text>
          {!skill.valid ? (
            <Text style={styles.invalidLabel}>{t("settings.project.skills.invalid")}</Text>
          ) : null}
        </View>
        <Text style={settingsStyles.rowHint} numberOfLines={2}>
          {skill.valid ? skill.description : skill.error}
        </Text>
        <Text style={styles.path} numberOfLines={1}>
          {skill.files.map((file) => file.provider).join(" + ")} · {skill.directoryName}/SKILL.md
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          onPress={edit}
          accessibilityRole="button"
          accessibilityLabel={t("settings.project.skills.actions.edit")}
          hitSlop={8}
          style={styles.iconButton}
        >
          <ThemedPencil size={15} color={styles.muted.color} />
        </Pressable>
        <Pressable
          onPress={remove}
          accessibilityRole="button"
          accessibilityLabel={t("settings.project.skills.actions.remove")}
          hitSlop={8}
          style={styles.iconButton}
        >
          <ThemedTrash size={15} color={styles.danger.color} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  muted: { color: theme.colors.foregroundMuted },
  warning: { color: theme.colors.palette.orange[500] },
  danger: { color: theme.colors.destructive },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[4],
  },
  skillRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  skillMain: { flex: 1, minWidth: 0, gap: theme.spacing[1] },
  skillTitleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  invalidLabel: { color: theme.colors.palette.orange[500], fontSize: theme.fontSize.xs },
  path: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing[3] },
  iconButton: { padding: theme.spacing[1] },
}));
