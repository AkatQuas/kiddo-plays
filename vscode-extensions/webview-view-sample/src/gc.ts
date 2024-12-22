import { Disposable } from "vscode";

const _toDispose: Disposable[] = [];

export const GC = {
  toDispose: _toDispose,
  push(...arg: Disposable[]) {
    _toDispose.push(...arg);
  },
  dispose() {
    _toDispose.forEach((d) => d.dispose());
  },
};

Object.defineProperty(GC, "toDispose", {
  writable: false,
});
