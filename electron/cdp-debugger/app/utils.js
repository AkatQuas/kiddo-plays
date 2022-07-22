"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureEndSlash = void 0;
var ensureEndSlash = function (s) {
    return s.endsWith('/') ? s : s.concat('/');
};
exports.ensureEndSlash = ensureEndSlash;
//# sourceMappingURL=utils.js.map