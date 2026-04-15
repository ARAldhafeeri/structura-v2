import * as vscode from "vscode";
import { GraphState } from "./GraphState.js";
import { CacheState } from "./Cache.js";
import { SessionState } from "./Session.js";
import { SemanticIndexState } from "./Semantic.js";
import type { IProcessorContext } from "../contract/TaskProcessor.js";
import type { IUserSettings } from "../contract/UserSettings.js";

/**
 * Thin adapter that maps the VS Code workspace configuration for the
 * 'structura' namespace to the IUserSettings interface expected by processors.
 */
class VscodeUserSettings implements IUserSettings {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration("structura");
  }

  get<T>(key: string): T {
    return this.config.get<T>(key) as T;
  }

  set<T>(key: string, value: T): void {
    // Update workspace-level setting (no await — fire and forget for processor use).
    this.config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  getAll(): Record<string, any> {
    return {
      "structura.baseDirectory": this.config.get("baseDirectory"),
      "structura.ignorePatterns": this.config.get("ignorePatterns"),
    };
  }
}

/**
 * Construct the single shared IProcessorContext that is injected into every
 * TaskProcessor handler.  All state objects are created fresh on each call so
 * that activate() starts with a clean slate.
 *
 * @param editor   The VS Code extension context provided by activate().
 * @param webview  Optional webview controller — may be set later once the
 *                 GraphPanel is created.
 */
export function buildContext(
  editor: vscode.ExtensionContext,
  webview?: IProcessorContext["webview"],
): IProcessorContext {
  return {
    graph: new GraphState(),
    cache: new CacheState(256, null, null),
    session: new SessionState(),
    semanticIndex: new SemanticIndexState(),
    settings: new VscodeUserSettings(),
    editor,
    webview,
  };
}
