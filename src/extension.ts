import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let enableAutoComplete = true;

    let enableCommand = vscode.commands.registerCommand('extension.enableSassAutocomplete', async () => {
        try {
            enableAutoComplete = true;
            vscode.window.showInformationMessage('✅ Sass Autocomplete has been enabled!');
            return true;
        } catch (err) {
            vscode.window.showErrorMessage('❌ Failed to enable Sass Autocomplete.');
        }
    });
    context.subscriptions.push(enableCommand);

    let insertUseCommand = vscode.commands.registerCommand('extension.insertUseAtTop', async (document: vscode.TextDocument, relativePath: string) => {
        const edit = new vscode.WorkspaceEdit();
        const documentText = document.getText();
        const lines = documentText.split('\n');

        const escapedPath = relativePath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const useRegex = new RegExp(`^\\s*@use\\s+["']${escapedPath}["'](?:\\s+as\\s+([^;]+))?\\s*;\\s*$`);

        let found = false;

        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(useRegex);
            if (match) {
                found = true;
                // If `as` is not `*`, replace the line
                if (match[1] !== '*') {
                    const newUseLine = `@use "${relativePath}" as *;`;
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, lines[i].length));
                    edit.replace(document.uri, range, newUseLine);
                    await vscode.workspace.applyEdit(edit);
                }
                break;
            }
        }

        if (!found) {
            const firstLine = new vscode.Position(0, 0);
            const useLine = `@use "${relativePath}" as *;`;
            edit.insert(document.uri, firstLine, `${useLine}\n`);
            await vscode.workspace.applyEdit(edit);
        }
    });
    context.subscriptions.push(insertUseCommand);

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('scss', new SassCompletionProvider(() => enableAutoComplete), '$'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('sass', new SassCompletionProvider(() => enableAutoComplete), '$'));
}

class SassCompletionProvider implements vscode.CompletionItemProvider {
    private isEnabled: () => boolean;

    constructor(isEnabled: () => boolean) {
        this.isEnabled = isEnabled;
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        if (!this.isEnabled()) {
            return [];
        }

        const currentFileDir = path.dirname(document.uri.fsPath);
        const sassFiles = await vscode.workspace.findFiles('**/*.{sass,scss}');
        const completions: vscode.CompletionItem[] = [];

        const variablesRegex = /\$[a-zA-Z0-9-_]+/g;
        const functionsRegex = /@function\s+([a-zA-Z0-9-_]+)/g;
        const mixinsRegex = /@mixin\s+([a-zA-Z0-9-_]+)/g;

        for (const fileUri of sassFiles) {
            const fileContent = await vscode.workspace.openTextDocument(fileUri);
            const fileText = fileContent.getText();
            const relativePath = path.relative(currentFileDir, fileUri.fsPath)
                .replace(/\\/g, '/')
                .replace(/\.(scss|sass)$/, '');

            const addCompletion = (name: string, kind: vscode.CompletionItemKind, insertText: string) => {
                const item = new vscode.CompletionItem(name, kind);
                item.insertText = insertText;
                item.detail = `From: ${relativePath}`;
                item.documentation = new vscode.MarkdownString(`**File:** \`${relativePath}\`\n\nAutomatically adds \`@use "${relativePath}" as *;\` at the top if missing.`);
                item.command = {
                    command: 'extension.insertUseAtTop',
                    title: 'Insert @use at top',
                    arguments: [document, relativePath]
                };
                completions.push(item);
            };

            const variables = fileText.match(variablesRegex);
            if (variables) {
                for (const variable of new Set(variables)) {
                    addCompletion(variable, vscode.CompletionItemKind.Variable, `$${variable.replace('$', '')}`);
                }
            }

            for (const [, funcName] of fileText.matchAll(functionsRegex)) {
                addCompletion(funcName, vscode.CompletionItemKind.Function, `${funcName}()`);
            }

            for (const [, mixinName] of fileText.matchAll(mixinsRegex)) {
                addCompletion(mixinName, vscode.CompletionItemKind.Method, `@include ${mixinName}();`);
            }
        }

        return completions;
    }
}

export function deactivate() {}