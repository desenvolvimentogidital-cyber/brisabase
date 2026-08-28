const fs = require('node:fs');

function patchFile(path, replacements) {
  const original = fs.readFileSync(path, 'utf8');
  let text = original.replace(/\r\n/g, '\n');
  let changed = false;

  for (const { before, after, label } of replacements) {
    if (text.includes(after)) continue;
    if (!text.includes(before)) {
      throw new Error(`Patch target not found in ${path}: ${label}`);
    }
    text = text.replace(before, after);
    changed = true;
    console.log(`patched ${path}: ${label}`);
  }

  if (changed) fs.writeFileSync(path, text, 'utf8');
  return changed;
}

let changedFiles = 0;

changedFiles += Number(patchFile('server/db/databasePhase2.ts', [
  {
    label: 'type schema diff maps explicitly',
    before: "    const oldTables = new Map(baseline.tables.map((table: any) => [String(table.name), table]));\n    const newTables = new Map(current.tables.map((table: any) => [String(table.name), table]));",
    after: "    const oldTables = new Map<string, any>(baseline.tables.map((table: any) => [String(table.name), table]));\n    const newTables = new Map<string, any>(current.tables.map((table: any) => [String(table.name), table]));"
  },
  {
    label: 'type baseline column map explicitly',
    before: "      const beforeColumns = new Map((before.columns || []).map((column: any) => [String(column.name), column]));",
    after: "      const beforeColumns = new Map<string, any>((before.columns || []).map((column: any) => [String(column.name), column]));"
  }
]));

changedFiles += Number(patchFile('src/components/ui/Button.tsx', [
  {
    label: 'support legacy icon prop',
    before: "  isLoading?: boolean;\n  leftIcon?: ReactNode;",
    after: "  isLoading?: boolean;\n  /** Compatibility alias for migrated views; prefer leftIcon for new code. */\n  icon?: ReactNode;\n  leftIcon?: ReactNode;"
  },
  {
    label: 'read icon prop',
    before: "  isLoading = false,\n  leftIcon,",
    after: "  isLoading = false,\n  icon,\n  leftIcon,"
  },
  {
    label: 'render compatibility icon',
    before: "      ) : leftIcon ? (\n        <span className=\"shrink-0\">{leftIcon}</span>\n      ) : null}",
    after: "      ) : (leftIcon ?? icon) ? (\n        <span className=\"shrink-0\">{leftIcon ?? icon}</span>\n      ) : null}"
  }
]));

changedFiles += Number(patchFile('examples/real-app/src/App.tsx', [
  {
    label: 'use canonical SDK package name',
    before: "from '@brisabase/sdk';",
    after: "from '@brisabase/js';"
  }
]));

changedFiles += Number(patchFile('examples/real-app/package.json', [
  {
    label: 'declare local SDK dependency',
    before: "  \"dependencies\": {\n    \"react\": \"^19.0.1\",",
    after: "  \"dependencies\": {\n    \"@brisabase/js\": \"file:../../developer/sdk\",\n    \"react\": \"^19.0.1\","
  }
]));

changedFiles += Number(patchFile('tsconfig.json', [
  {
    label: 'resolve local SDK source during root typecheck',
    before: "    \"paths\": {\n      \"@/*\": [\n        \"./*\"\n      ]\n    },",
    after: "    \"paths\": {\n      \"@/*\": [\n        \"./*\"\n      ],\n      \"@brisabase/js\": [\n        \"./developer/sdk/index.ts\"\n      ]\n    },"
  }
]));

changedFiles += Number(patchFile('src/context/AppContext.tsx', [
  {
    label: 'declare migrated-view compatibility API',
    before: "  currentProject: Project | null;\n  environment: string;\n  isLoadingProjects: boolean;\n  addToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;\n  notifications: NotificationItem[];\n  unreadNotificationsCount: number;\n  markAllNotificationsRead: () => void;\n  toasts: ToastItem[];\n  showToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;\n  removeToast: (id: string) => void;\n  isSearchOpen: boolean;\n  setIsSearchOpen: (open: boolean) => void;",
    after: "  currentProject: Project | null;\n  environment: Project['category'];\n  setEnvironment: (environment: Project['category']) => Promise<void>;\n  isLoadingProjects: boolean;\n  addToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;\n  notifications: NotificationItem[];\n  unreadNotificationsCount: number;\n  markNotificationAsRead: (notificationId: string) => void;\n  markAllNotificationsRead: () => void;\n  markAllNotificationsAsRead: () => void;\n  toasts: ToastItem[];\n  showToast: (title: string, description?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;\n  removeToast: (id: string) => void;\n  isSearchOpen: boolean;\n  setIsSearchOpen: (open: boolean) => void;\n  isGlobalSearchOpen: boolean;\n  setGlobalSearchOpen: (open: boolean) => void;\n  isMobileSidebarOpen: boolean;\n  setMobileSidebarOpen: (open: boolean) => void;"
  },
  {
    label: 'add mobile sidebar state',
    before: "  const [toasts, setToasts] = useState<ToastItem[]>([]);\n  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);",
    after: "  const [toasts, setToasts] = useState<ToastItem[]>([]);\n  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);\n  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);"
  },
  {
    label: 'implement environment compatibility setter',
    before: "  const selectProject = (projectId: string) => {\n    const project = projects.find((item) => item.id === projectId);\n    if (project) setActiveProject(project);\n  };\n\n  const createProject = async",
    after: "  const selectProject = (projectId: string) => {\n    const project = projects.find((item) => item.id === projectId);\n    if (project) setActiveProject(project);\n  };\n\n  const setEnvironment = async (nextEnvironment: Project['category']): Promise<void> => {\n    if (!activeProject || activeProject.category === nextEnvironment) return;\n    try {\n      const updated = await mockApi.updateProject(activeProject.id, {\n        category: nextEnvironment,\n        environment: nextEnvironment\n      });\n      setProjects((prev) => prev.map((project) => project.id === updated.id ? updated : project));\n      setActiveProjectState(updated);\n      localStorage.setItem('brisabase_active_project_id', updated.id);\n      if (isRealMode) await configureRealProjectScope(updated);\n      showToast('Ambiente alterado', `Ambiente ativo: ${nextEnvironment}`, 'info');\n    } catch (error) {\n      const description = error instanceof Error ? error.message : 'Não foi possível alterar o ambiente.';\n      setRuntimeError(description);\n      showToast('Falha ao alterar ambiente', description, 'error');\n    }\n  };\n\n  const createProject = async"
  },
  {
    label: 'implement single notification read state',
    before: "  const markAllNotificationsRead = async () => {",
    after: "  const markNotificationAsRead = (notificationId: string) => {\n    setNotifications((prev) => prev.map((notification) =>\n      notification.id === notificationId ? { ...notification, read: true } : notification\n    ));\n  };\n\n  const markAllNotificationsRead = async () => {"
  },
  {
    label: 'provide migrated-view compatibility values',
    before: "        currentProject: activeProject,\n        environment: activeProject?.category || 'development',\n        isLoadingProjects: !authReady,",
    after: "        currentProject: activeProject,\n        environment: activeProject?.category || 'development',\n        setEnvironment,\n        isLoadingProjects: !authReady,"
  },
  {
    label: 'provide notification aliases',
    before: "        unreadNotificationsCount,\n        markAllNotificationsRead,\n        toasts,",
    after: "        unreadNotificationsCount,\n        markNotificationAsRead,\n        markAllNotificationsRead,\n        markAllNotificationsAsRead: markAllNotificationsRead,\n        toasts,"
  },
  {
    label: 'provide search and mobile aliases',
    before: "        isSearchOpen,\n        setIsSearchOpen\n      }}",
    after: "        isSearchOpen,\n        setIsSearchOpen,\n        isGlobalSearchOpen: isSearchOpen,\n        setGlobalSearchOpen: setIsSearchOpen,\n        isMobileSidebarOpen,\n        setMobileSidebarOpen\n      }}"
  }
]));

console.log(`Final release patch complete. Changed files: ${changedFiles}`);
