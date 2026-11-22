export class LoadError extends Error {
  override readonly name = "LoadError";
}

export function fail(message: string): never {
  throw new LoadError(message);
}
