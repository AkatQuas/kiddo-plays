import type { Pluggable, PluggableList } from 'unified';

function wrapTransformer(transformer: unknown): unknown {
  if (typeof transformer !== 'function') {
    return transformer;
  }

  return function safeTransformer(this: unknown, ...args: unknown[]) {
    try {
      return (transformer as (...innerArgs: unknown[]) => unknown).apply(
        this,
        args,
      );
    } catch {
      return undefined;
    }
  };
}

function wrapPluginFn(fn: unknown): unknown {
  if (typeof fn !== 'function') {
    return fn;
  }

  return function safePlugin(this: unknown, ...args: unknown[]) {
    const result = (fn as (...innerArgs: unknown[]) => unknown).apply(
      this,
      args,
    );
    if (typeof result === 'function') {
      return wrapTransformer(result);
    }
    return result;
  };
}

export function wrapRemarkPlugin(plugin: Pluggable): Pluggable {
  if (Array.isArray(plugin)) {
    const [fn, ...rest] = plugin;
    return [wrapPluginFn(fn), ...rest] as Pluggable;
  }
  return wrapPluginFn(plugin) as Pluggable;
}

export function wrapRemarkPlugins(plugins: PluggableList = []): PluggableList {
  return plugins.map(wrapRemarkPlugin);
}
