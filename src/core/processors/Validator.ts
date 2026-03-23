import type { TaskProcessorHandler } from "../../contract/TaskProcessor.js";

// ============================================================================
// Validator processors
// Handlers for loading and updating user-facing settings.
// Mapped from core/Validator.ts
// ============================================================================

export const onUpdateSettings: TaskProcessorHandler = async (task, ctx) => {
  if (!ctx) return false;
  const updates: Record<string, any> = task.data?.updates ?? {};

  for (const [key, value] of Object.entries(updates)) {
    ctx.settings.set(key, value);
  }
  return true;
};

export const onLoadSettings: TaskProcessorHandler = async (_task, ctx) => {
  if (!ctx) return false;
  // Trigger a fresh read of all settings and push them to the webview
  const all = ctx.settings.getAll();
  ctx.webview?.postMessage({ command: "settingsLoaded", settings: all });
  return true;
};
