"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function activate(context) {
    let enableAutoComplete = true;
    let enableCommand = vscode.commands.registerCommand('extension.enableSassAutocomplete', () => {
        enableAutoComplete = true;
        vscode.window.showInformationMessage('Sass Autocomplete is now enabled!');
    });
    context.subscriptions.push(enableCommand);
    let insertUseCommand = vscode.commands.registerCommand('extension.insertUseAtTop', (document, relativePath) => __awaiter(this, void 0, void 0, function* () {
        const edit = new vscode.WorkspaceEdit();
        const firstLine = new vscode.Position(0, 0);
        const documentText = document.getText();
        const usePath = `@use \"${relativePath}\";`;
        if (!documentText.includes(usePath)) {
            edit.insert(document.uri, firstLine, `${usePath}\n`);
            yield vscode.workspace.applyEdit(edit);
        }
    }));
    context.subscriptions.push(insertUseCommand);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('scss', new SassCompletionProvider(() => enableAutoComplete), '$'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('sass', new SassCompletionProvider(() => enableAutoComplete), '$'));
}
exports.activate = activate;
class SassCompletionProvider {
    constructor(isEnabled) {
        this.isEnabled = isEnabled;
    }
    provideCompletionItems(document, position) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isEnabled()) {
                return [];
            }
            const currentFileDir = path.dirname(document.uri.fsPath);
            const sassFiles = yield vscode.workspace.findFiles('**/*.{sass,scss}');
            const completions = [];
            const variablesRegex = /\$[a-zA-Z0-9-_]+/g;
            const functionsRegex = /@function\s+([a-zA-Z0-9-_]+)/g;
            const mixinsRegex = /@mixin\s+([a-zA-Z0-9-_]+)/g;
            for (const fileUri of sassFiles) {
                const fileContent = yield vscode.workspace.openTextDocument(fileUri);
                const relativePath = path.relative(currentFileDir, fileUri.fsPath)
                    .replace(/\\/g, '/')
                    .replace(/\.(scss|sass)$/, '');
                const fileText = fileContent.getText();
                const addCompletion = (name, kind, insertText) => {
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
        });
    }
}
function deactivate() { }
exports.deactivate = deactivate;
