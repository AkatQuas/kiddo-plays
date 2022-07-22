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
exports.Courier = void 0;
var electron_1 = require("electron");
var tsyringe_1 = require("tsyringe");
var cdp_service_1 = require("./cdp.service");
var port_service_1 = require("./port.service");
var window_manager_1 = require("./window-manager");
var Courier = /** @class */ (function () {
    function Courier(cdp, portSrv, wm) {
        this.cdp = cdp;
        this.portSrv = portSrv;
        this.wm = wm;
    }
    Courier.prototype.listen = function () {
        var _this = this;
        electron_1.ipcMain.handle('CDP:list', function (_) { return _this.cdp.fetchList(); });
        electron_1.ipcMain.handle('PORT:update', function (_, ports) {
            _this.portSrv.update(ports);
        });
        electron_1.ipcMain.handle('PORT:list', function (_) { return _this.portSrv.list(); });
        electron_1.ipcMain.handle('CDP:debug', function (_, page) {
            return _this.wm.openPageDevtools(page);
        });
        electron_1.ipcMain.on('SHELL:open', function (_, url) { return electron_1.shell.openExternal(url); });
    };
    Courier.prototype.schedule = function () { };
    Courier = __decorate([
        (0, tsyringe_1.singleton)(),
        __param(0, (0, tsyringe_1.inject)(cdp_service_1.CDPService)),
        __param(1, (0, tsyringe_1.inject)(port_service_1.PortService)),
        __param(2, (0, tsyringe_1.inject)(window_manager_1.WindowManager)),
        __metadata("design:paramtypes", [cdp_service_1.CDPService,
            port_service_1.PortService,
            window_manager_1.WindowManager])
    ], Courier);
    return Courier;
}());
exports.Courier = Courier;
//# sourceMappingURL=courier.js.map