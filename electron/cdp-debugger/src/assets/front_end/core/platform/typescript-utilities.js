export function assertNotNullOrUndefined(val) {
  if (val === null || val === void 0) {
    throw new Error(`Expected given value to not be null/undefined but it was: ${val}`);
  }
}
export function assertNever(type, message) {
  throw new Error(message);
}
export function assertUnhandled(_caseVariable) {
  return _caseVariable;
}
//# sourceMappingURL=typescript-utilities.js.map
