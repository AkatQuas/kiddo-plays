"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardWindow = void 0;
var electron_1 = require("electron");
var node_url_1 = require("node:url");
var DashboardWindow = /** @class */ (function () {
    function DashboardWindow(env) {
        this.env = env;
    }
    DashboardWindow.prototype.show = function () {
        if (!this._win) {
            this._createWindow();
        }
        this._win.show();
    };
    DashboardWindow.prototype._createWindow = function () {
        var _this = this;
        var electronScreen = electron_1.screen;
        var _a = electronScreen.getPrimaryDisplay().workAreaSize, sw = _a.width, sh = _a.height;
        var width = 800;
        var height = 750;
        var win = (this._win = new electron_1.BrowserWindow({
            x: Math.ceil((sw - width) / 2),
            y: Math.ceil((sh - height) / 2),
            title: 'Debugger',
            width: width,
            height: height,
            webPreferences: {
                nodeIntegration: true,
                // allowRunningInsecureContent: false,
                contextIsolation: false,
            },
        }));
        win.on('closed', function () {
            _this._win = null;
        });
        if (this.env.serve) {
            require('electron-debug')();
            require('electron-reloader')(module);
        }
        var r = new node_url_1.URL('index.html', this.env.assetsBase);
        this._win.loadURL(r.toString());
    };
    return DashboardWindow;
}());
exports.DashboardWindow = DashboardWindow;
//# sourceMappingURL=dashboard.window.js.map