import * as vscode from 'vscode';

export const config = vscode.workspace.getConfiguration('structura');
export const baseDir = config.get<string>('baseDirectory');
export const ignorePatterns = config.get<string[]>('ignorePatterns') || [];

