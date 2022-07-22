"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
var electron_1 = require("electron");
var tsyringe_1 = require("tsyringe");
var utils_1 = require("./utils");
var Environment = /** @class */ (function () {
    function Environment() {
        this._parse();
    }
    Object.defineProperty(Environment.prototype, "serve", {
        get: function () {
            return this._serve;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Environment.prototype, "assetsBase", {
        get: function () {
            return this._serve
                ? 'http://localhost:4200/'
                : (0, utils_1.ensureEndSlash)("file://".concat(electron_1.app.getAppPath()));
        },
        enumerable: false,
        configurable: true
    });
    Environment.prototype._parse = function () {
        var args = process.argv.slice(1);
        this._serve = args.some(function (v) { return v === '--serve'; });
    };
    Environment = __decorate([
        (0, tsyringe_1.singleton)(),
        __metadata("design:paramtypes", [])
    ], Environment);
    return Environment;
}());
exports.Environment = Environment;
//# sourceMappingURL=environment.js.map