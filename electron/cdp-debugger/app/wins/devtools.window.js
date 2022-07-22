"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevtoolsWindow = void 0;
var electron_1 = require("electron");
var EventEmitter = require("events");
var DevtoolsWindow = /** @class */ (function (_super) {
    __extends(DevtoolsWindow, _super);
    function DevtoolsWindow(env, page) {
        var _this = _super.call(this) || this;
        _this.env = env;
        _this.page = page;
        _this._createWindow();
        return _this;
    }
    DevtoolsWindow.prototype.show = function () {
        var r = new URL("assets/front_end/".concat(this._inspectorFile()), this.env.assetsBase);
        r.searchParams.set('ws', this.page.webSocketDebuggerUrl.replace(/ws+:\/\//, ''));
        r.searchParams.set('remoteFrontend', 'true');
        this._win.loadURL(r.toString());
    };
    DevtoolsWindow.prototype._inspectorFile = function () {
        return this.page.type === 'node' ? 'js_app.html' : 'inspector.html';
    };
    DevtoolsWindow.prototype._createWindow = function () {
        var _this = this;
        var electronScreen = electron_1.screen;
        var _a = electronScreen.getPrimaryDisplay().workAreaSize, width = _a.width, height = _a.height;
        var win = (this._win = new electron_1.BrowserWindow({
            width: Math.ceil(width / 2),
            height: Math.ceil(height / 2),
            webPreferences: {
                nodeIntegration: false,
                allowRunningInsecureContent: false,
                contextIsolation: false,
            },
        }));
        win.on('closed', function () {
            _this._win = null;
            _this.emit('closed');
        });
    };
    return DevtoolsWindow;
}(EventEmitter));
exports.DevtoolsWindow = DevtoolsWindow;
//# sourceMappingURL=devtools.window.js.map