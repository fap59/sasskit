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
let sassCache = {};
let isCacheReady = false;
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = '$(refresh) Sass Cache';
        statusBarItem.tooltip = 'Refresh Sass autocomplete cache';
        statusBarItem.command = 'extension.refreshSassCache';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        const refreshCommand = vscode.commands.registerCommand('extension.refreshSassCache', () => __awaiter(this, void 0, void 0, function* () {
            yield refreshSassCache();
            vscode.window.setStatusBarMessage('Sass Kit: Cache refreshed ✔️', 3000);
        }));
        context.subscriptions.push(refreshCommand);
        const insertUseCommand = vscode.commands.registerCommand('extension.insertUseAtTop', (document, relPath) => __awaiter(this, void 0, void 0, function* () {
            const edit = new vscode.WorkspaceEdit();
            const isSassFile = document.fileName.endsWith('.sass');
            const useStatement = `@use "${relPath}" as *${isSassFile ? '' : ';'}\n`;
            const alreadyUsed = document.getText().includes(useStatement.trim());
            if (alreadyUsed)
                return;
            const firstLine = document.lineAt(0);
            edit.insert(document.uri, firstLine.range.start, useStatement);
            yield vscode.workspace.applyEdit(edit);
        }));
        context.subscriptions.push(insertUseCommand);
        const provider = new SassCompletionProvider(() => isCacheReady);
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(['scss', 'sass'], provider, '$', '@'));
        yield refreshSassCache();
    });
}
exports.activate = activate;
function refreshSassCache() {
    return __awaiter(this, void 0, void 0, function* () {
        sassCache = {};
        const sassFiles = yield vscode.workspace.findFiles('**/*.{sass,scss}');
        for (const fileUri of sassFiles) {
            const fileText = (yield vscode.workspace.openTextDocument(fileUri)).getText();
            const variables = [...new Set(fileText.match(/\$[a-zA-Z0-9-_]+/g) || [])];
            const functions = [...fileText.matchAll(/@function\s+([a-zA-Z0-9-_]+)/g)].map(m => m[1]);
            const mixins = [...fileText.matchAll(/@mixin\s+([a-zA-Z0-9-_]+)/g)].map(m => m[1]);
            sassCache[fileUri.fsPath] = {
                variables: new Set(variables),
                functions: new Set(functions),
                mixins: new Set(mixins)
            };
        }
        isCacheReady = true;
    });
}
class SassCompletionProvider {
    constructor(isEnabled) {
        this.isEnabled = isEnabled;
    }
    provideCompletionItems(document, position) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isEnabled())
                return [];
            const completions = [];
            const currentDir = path.dirname(document.uri.fsPath);
            for (const filePath in sassCache) {
                const relPath = path.relative(currentDir, filePath)
                    .replace(/\\/g, '/')
                    .replace(/\.(scss|sass)$/, '');
                const data = sassCache[filePath];
                for (const variable of data.variables) {
                    const item = new vscode.CompletionItem(variable, vscode.CompletionItemKind.Variable);
                    item.insertText = variable;
                    item.detail = `From: ${relPath}`;
                    item.command = {
                        command: 'extension.insertUseAtTop',
                        title: 'Insert @use',
                        arguments: [document, relPath]
                    };
                    completions.push(item);
                }
                for (const func of data.functions) {
                    const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
                    item.insertText = `${func}()`;
                    item.detail = `From: ${relPath}`;
                    item.command = {
                        command: 'extension.insertUseAtTop',
                        title: 'Insert @use',
                        arguments: [document, relPath]
                    };
                    completions.push(item);
                }
                for (const mixin of data.mixins) {
                    const item = new vscode.CompletionItem(mixin, vscode.CompletionItemKind.Method);
                    item.insertText = `@include ${mixin}();`;
                    item.detail = `From: ${relPath}`;
                    item.command = {
                        command: 'extension.insertUseAtTop',
                        title: 'Insert @use',
                        arguments: [document, relPath]
                    };
                    completions.push(item);
                }
            }
            return completions;
        });
    }
}
function deactivate() { }
exports.deactivate = deactivate;
