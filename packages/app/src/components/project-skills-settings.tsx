import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCode2, Plus, RefreshCw } from "lucide-react-native";
import { Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/contexts/toast-context";
import { SettingsGroup } from "@/screens/settings/settings-group";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { confirmDialog } from "@/utils/confirm-dialog";
import { useFetchQuery } from "@/data/query";
import { ProjectSkillEditor } from "@/project-skills/editor";
import type { ProjectSkill, SkillDraft } from "@/project-skills/model";
import { ProjectSkillRow } from "@/project-skills/row";
import {
  createProjectSkill,
  deleteProjectSkill,
  loadProjectSkills,
  updateProjectSkill,
} from "@/project-skills/operations";

const ThemedRefresh = withUnistyles(RefreshCw);
const ThemedFileCode = withUnistyles(FileCode2);

export function ProjectSkillsSettings({
  client,
  serverId,
  repoRoot,
}: {
  client: DaemonClient;
  serverId: string;
  repoRoot: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editor, setEditor] = useState<ProjectSkill | null | undefined>(undefined);
  const [operationError, setOperationError] = useState<string | null>(null);
  const queryKey = useMemo(
    () => ["project-skills", serverId, repoRoot] as const,
    [repoRoot, serverId],
  );
  const query = useFetchQuery({
    queryKey,
    queryFn: () => loadProjectSkills(client, repoRoot),
    retry: false,
    dataShape: "list",
    staleTimeMs: 0,
  });
  const recoverFromSaveError = useCallback(
    async (failedSkill: ProjectSkill | null) => {
      await queryClient.invalidateQueries({ queryKey }).catch(() => undefined);
      if (!failedSkill) return;
      const refreshed = queryClient
        .getQueryData<ProjectSkill[]>(queryKey)
        ?.find((skill) => skill.directoryName === failedSkill.directoryName);
      if (refreshed) setEditor(refreshed);
    },
    [queryClient, queryKey],
  );

  const saveMutation = useMutation({
    mutationFn: (input: { skill: ProjectSkill | null; draft: SkillDraft }) =>
      input.skill
        ? updateProjectSkill(client, repoRoot, input.skill, input.draft)
        : createProjectSkill(client, repoRoot, input.draft),
    onSuccess: () => {
      setOperationError(null);
      setEditor(undefined);
      void queryClient.invalidateQueries({ queryKey });
      toast.show(t("settings.project.skills.saved"), { variant: "success" });
    },
    onError: (error, input) => {
      setOperationError(error instanceof Error ? error.message : String(error));
      void recoverFromSaveError(input.skill);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (skill: ProjectSkill) => deleteProjectSkill(client, repoRoot, skill),
    onSuccess: () => {
      setOperationError(null);
      void queryClient.invalidateQueries({ queryKey });
      toast.show(t("settings.project.skills.deleted"), { variant: "success" });
    },
    onError: (error) => {
      setOperationError(error instanceof Error ? error.message : String(error));
    },
  });

  const reload = useCallback(() => {
    setOperationError(null);
    void query.refetch();
  }, [query]);
  const openNew = useCallback(() => {
    setOperationError(null);
    setEditor(null);
  }, []);
  const openEditor = useCallback((skill: ProjectSkill) => {
    setOperationError(null);
    setEditor(skill);
  }, []);
  const closeEditor = useCallback(() => {
    if (!saveMutation.isPending) setEditor(undefined);
  }, [saveMutation.isPending]);
  const save = useCallback(
    (draft: SkillDraft) => saveMutation.mutate({ skill: editor ?? null, draft }),
    [editor, saveMutation],
  );
  const remove = useCallback(
    async (skill: ProjectSkill) => {
      const confirmed = await confirmDialog({
        title: t("settings.project.skills.removeTitle"),
        message: t("settings.project.skills.removeMessage", { name: skill.directoryName }),
        confirmLabel: t("settings.project.skills.actions.remove"),
        cancelLabel: t("settings.project.actions.cancel"),
        destructive: true,
      });
      if (!confirmed) return;
      setOperationError(null);
      deleteMutation.mutate(skill);
    },
    [deleteMutation, t],
  );

  const trailing = useMemo(
    () => (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={Plus}
        textStyle={settingsStyles.sectionHeaderLinkText}
        style={settingsStyles.sectionHeaderLink}
        onPress={openNew}
        accessibilityLabel={t("settings.project.skills.actions.add")}
        testID="project-skills-add"
      >
        {t("settings.project.skills.actions.add")}
      </Button>
    ),
    [openNew, t],
  );

  const loadErrorDescription =
    query.error instanceof Error
      ? query.error.message
      : t("settings.project.skills.loadFailedDescription");
  let content: ReactNode;
  if (query.isLoading) {
    content = (
      <View style={[settingsStyles.card, styles.loading]} testID="project-skills-loading">
        <LoadingSpinner color={styles.muted.color} />
      </View>
    );
  } else if (query.isError) {
    content = (
      <Alert
        testID="project-skills-load-error"
        variant="error"
        title={t("settings.project.skills.loadFailedTitle")}
        description={loadErrorDescription}
      >
        <Button variant="outline" size="sm" onPress={reload} leftIcon={ThemedRefresh}>
          {t("settings.project.actions.reload")}
        </Button>
      </Alert>
    );
  } else {
    const skills = query.data ?? [];
    content = (
      <View style={settingsStyles.card} testID="project-skills-list">
        {skills.length > 0 ? (
          skills.map((skill, index) => (
            <ProjectSkillRow
              key={skill.directoryName}
              skill={skill}
              first={index === 0}
              onEdit={openEditor}
              onRemove={remove}
            />
          ))
        ) : (
          <View style={settingsStyles.row} testID="project-skills-empty">
            <ThemedFileCode size={18} color={styles.muted.color} />
            <View style={styles.emptyCopy}>
              <Text style={settingsStyles.rowTitle}>{t("settings.project.skills.emptyTitle")}</Text>
              <Text style={settingsStyles.rowHint}>
                {t("settings.project.skills.emptyDescription")}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <SettingsGroup
      title={t("settings.project.skills.title")}
      info={t("settings.project.skills.info")}
      trailing={trailing}
      testID="project-skills-group"
    >
      <SettingsSection title={t("settings.project.skills.sectionTitle")} flush>
        {content}
        {operationError && editor === undefined ? (
          <Alert
            testID="project-skills-operation-error"
            variant="error"
            title={t("settings.project.skills.operationFailedTitle")}
            description={operationError}
          />
        ) : null}
      </SettingsSection>
      {editor !== undefined ? (
        <ProjectSkillEditor
          key={`${editor?.directoryName ?? "new"}:${editor?.files.map((file) => file.revision ?? file.modifiedAt).join("|")}`}
          skill={editor}
          error={operationError}
          saving={saveMutation.isPending}
          onCancel={closeEditor}
          onSave={save}
        />
      ) : null}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { minHeight: 80, alignItems: "center", justifyContent: "center" },
  muted: { color: theme.colors.foregroundMuted },
  emptyCopy: { flex: 1, gap: theme.spacing[1] },
}));
