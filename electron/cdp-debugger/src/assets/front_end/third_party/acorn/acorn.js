import * as acorn from "./package/dist/acorn.mjs";
export {};
export { defaultOptions, getLineInfo, isNewLine, lineBreak, lineBreakG, Node, SourceLocation, Token, tokTypes, tokContexts } from "./package/dist/acorn.mjs";
export const Parser = acorn.Parser;
export const tokenizer = acorn.Parser.tokenizer.bind(acorn.Parser);
export const parse = acorn.Parser.parse.bind(acorn.Parser);
//# sourceMappingURL=acorn.js.map
