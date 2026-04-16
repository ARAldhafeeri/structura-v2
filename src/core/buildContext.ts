import * as vscode from "vscode";
import { GraphState } from "./GraphState.js";
import { CacheState } from "./Cache.js";
import { SessionState } from "./Session.js";
import { SemanticIndexState } from "./Semantic.js";
import type { IProcessorContext, IProcessorContextComponent } from "../contract/TaskProcessor.js";
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
 * that activate() starts with a clean slate. Should build context gracefully and return 
 * what it can 
 *
 * @param editor   The VS Code extension context provided by activate().
 * @param webview  Optional webview controller — may be set later once the
 *                 GraphPanel is created.
 */
export function buildContext(
  editor: vscode.ExtensionContext,
  webview?: IProcessorContext["webview"],
): IProcessorContext {

  const context : Partial<IProcessorContext> = {};
  const logError = (component : string, errorMessage: string) => console.log(`Failed to intialiaze ${component} into context Error: ${errorMessage}`)
   const buildContextGracefully = (components : IProcessorContextComponent[]) => {
    for(var comp of components) {
      try {
        context[comp.key] = comp.value;
      } catch (e: any) {
        logError(comp.key, e.msg)
      }
    }
   }

   const buildSingleComponent = (key: IProcessorContextComponent["key"], value: IProcessorContextComponent["value"] ) => {
    return  {
      key,
      value,
    }
   }

  buildContextGracefully([
    buildSingleComponent("graph", new GraphState()),
    buildSingleComponent("cache", new CacheState(256, null, null)),
    buildSingleComponent("session", new SessionState()),
    buildSingleComponent("semanticIndex", new SemanticIndexState()),
    buildSingleComponent("settings", new VscodeUserSettings()),
    buildSingleComponent("editor", editor),
    buildSingleComponent("webview", webview), 

  ])
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
