import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { MESSAGES } from './constants';

/**
 * Opens the source file containing the route and positions the cursor
 * directly on the route declaration line and column, revealing it in the center.
 *
 * Safe execution: catches missing or moved files and alerts the user without crashing.
 *
 * @param route The ApiRoute to navigate to.
 */
export async function openRoute(route: ApiRoute): Promise<void> {
  if (!route || !route.filePath) {
    return;
  }

  try {
    const fileUri = vscode.Uri.file(route.filePath);
    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false,
    });

    const maxLine = Math.max(0, document.lineCount - 1);
    const safeLine = Math.min(Math.max(0, route.line), maxLine);
    const lineLength = document.lineAt(safeLine).text.length;
    const safeColumn = Math.min(Math.max(0, route.column), lineLength);
    const position = new vscode.Position(safeLine, safeColumn);
    const selection = new vscode.Selection(position, position);

    editor.selection = selection;
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  } catch (error) {
    console.error(`[API Routes Explorer] Could not open route source file: ${route.filePath}`, error);
    vscode.window.showErrorMessage(MESSAGES.FILE_NOT_FOUND);
  }
}

/**
 * Opens a source file in the active editor without moving the cursor to a specific line.
 *
 * @param filePath The absolute file path to open.
 */
export async function openFile(filePath: string): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    const fileUri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false,
    });
  } catch (error) {
    console.error(`[API Routes Explorer] Could not open file: ${filePath}`, error);
    vscode.window.showErrorMessage(MESSAGES.FILE_NOT_FOUND);
  }
}
