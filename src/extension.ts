import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let enableAutoComplete = true;

    let enableCommand = vscode.commands.registerCommand('extension.enableSassAutocomplete', () => {
        enableAutoComplete = true;
        vscode.window.showInformationMessage('Sass Autocomplete is now enabled!');
    });
    context.subscriptions.push(enableCommand);

    let insertUseCommand = vscode.commands.registerCommand('extension.insertUseAtTop', async (document: vscode.TextDocument, relativePath: string) => {
        const edit = new vscode.WorkspaceEdit();
        const firstLine = new vscode.Position(0, 0);
        const documentText = document.getText();
        const usePath = `@use \"${relativePath}\";`;

        if (!documentText.includes(usePath)) {
            edit.insert(document.uri, firstLine, `${usePath}\n`);
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
            const relativePath = path.relative(currentFileDir, fileUri.fsPath)
                .replace(/\\/g, '/')
                .replace(/\.(scss|sass)$/, '');
            const fileText = fileContent.getText();

            const addCompletion = (name: string, kind: vscode.CompletionItemKind, insertText: string) => {
                const item = new vscode.CompletionItem(name, kind);
                item.insertText = insertText;
                item.detail = `From: ${relativePath}`;
                item.documentation = new vscode.MarkdownString(`**File:** \`${relativePath}\`\n\nAutomatically adds \`@use \"${relativePath}\";\` at the top.`);
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