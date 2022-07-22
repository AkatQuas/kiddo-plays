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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowManager = void 0;
var tsyringe_1 = require("tsyringe");
var environment_1 = require("./environment");
var dashboard_window_1 = require("./wins/dashboard.window");
var devtools_window_1 = require("./wins/devtools.window");
var WindowManager = /** @class */ (function () {
    function WindowManager(env) {
        this.env = env;
        this._devWindows = new Map();
        this._dashboard = new dashboard_window_1.DashboardWindow(env);
    }
    WindowManager.prototype.openDashboard = function () {
        this._dashboard.show();
    };
    WindowManager.prototype.openPageDevtools = function (page) {
        var _this = this;
        var id = page.id;
        if (this._devWindows.has(id)) {
            this._devWindows.get(id).show();
            return;
        }
        var webWin = new devtools_window_1.DevtoolsWindow(this.env, page);
        webWin.show();
        webWin.on('closed', function () {
            _this._devWindows.delete(id);
        });
        this._devWindows.set(id, webWin);
    };
    WindowManager = __decorate([
        (0, tsyringe_1.singleton)(),
        __param(0, (0, tsyringe_1.inject)(environment_1.Environment)),
        __metadata("design:paramtypes", [environment_1.Environment])
    ], WindowManager);
    return WindowManager;
}());
exports.WindowManager = WindowManager;
//# sourceMappingURL=window-manager.js.map