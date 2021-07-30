"use strict";
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
const vscode = require("vscode");
const tokenTypes = new Map();
const tokenModifiers = new Map();
const legend = (function () {
    const tokenTypesLegend = [
        'comment',
        'string',
        'keyword',
        'number',
        'regexp',
        'operator',
        'namespace',
        'type',
        'struct',
        'class',
        'interface',
        'enum',
        'typeParameter',
        'function',
        'method',
        'macro',
        'variable',
        'parameter',
        'property',
        'label',
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
    const tokenModifiersLegend = [
        'declaration',
        'documentation',
        'readonly',
        'static',
        'abstract',
        'deprecated',
        'modification',
        'async',
    ];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));
    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({
        language: 'semantic',
    }, new DocumentSemanticTokenProvider(), legend));
    context.subscriptions.push(vscode.languages.registerHoverProvider('javascript', {
        provideHover(document, position, token) {
            console.log('document.fileName -> ', document.fileName);
            console.log('document.languageId -> ', document.languageId);
            console.log(`position.line -> `, position.line);
            console.log(`position.character -> `, position.character);
            console.log('token -> ', token);
            return {
                contents: ['Hover Content'],
            };
        },
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
class DocumentSemanticTokenProvider {
    constructor() { }
    provideDocumentSemanticTokens(document, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const allTokens = this._parseText(document.getText());
            const builder = new vscode.SemanticTokensBuilder();
            console.log(allTokens);
            allTokens.forEach((token) => {
                builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType));
            });
            return builder.build();
        });
    }
    _encodeTokenType(tokenType) {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType);
        }
        if (tokenType === 'notInLegend') {
            return tokenTypes.size + 2;
        }
        return 0;
    }
    _encodeTokenModifiers(strTokenModifiers) {
        let result = 0;
        for (let i = 0, l = strTokenModifiers.length; i < l; i++) {
            const tokenModifier = strTokenModifiers[i];
            if (tokenModifiers.has(tokenModifier)) {
                result = result | (1 << tokenModifiers.get(tokenModifier));
            }
            else if (tokenModifier === 'notInLegend') {
                result = result | (1 << (tokenModifiers.size + 2));
            }
        }
        return result;
    }
    _parseText(text) {
        const r = [];
        const lines = text.split(/\r\n|\r|\n/);
        for (let i = 0, l = lines.length; i < l; i++) {
            const line = lines[i];
            let currentOffset = 0;
            do {
                const openOffset = line.indexOf('[', currentOffset);
                if (openOffset === -1) {
                    // no opening [ found
                    break;
                }
                const closeOffset = line.indexOf(']', openOffset);
                if (closeOffset === -1) {
                    // no closing ] found
                    break;
                }
                const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
                r.push({
                    line: i,
                    startCharacter: openOffset + 1,
                    length: closeOffset - openOffset - 1,
                    tokenType: tokenData.tokenType,
                    tokenModifiers: tokenData.tokenModifiers,
                });
                currentOffset = closeOffset;
            } while (true);
        }
        return r;
    }
    _parseTextToken(text) {
        const parts = text.split('.');
        return {
            tokenType: parts[0],
            tokenModifiers: parts.slice(1),
        };
    }
}
//# sourceMappingURL=extension.js.map