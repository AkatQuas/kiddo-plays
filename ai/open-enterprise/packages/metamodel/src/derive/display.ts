import type { Field, FieldType } from "../schema/fields.js";

export type ScalarDisplayField = Pick<Field, "key" | "type"> & {
  readonly type: Exclude<FieldType, "attachment" | "subtable">;
};

export interface ScalarDisplayContext {
  readonly timeZone: string;
  readonly datetimeSeconds?: boolean;
  /** Authorized label for ref / enum / refLine; when it is missing, show the stable value unchanged. */
  readonly label?: (value: string) => string | undefined;
}

export class ScalarDisplayValueError extends Error {
  override readonly name = "ScalarDisplayValueError";
}

const MONEY = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMBER = new Intl.NumberFormat("zh-CN", { useGrouping: false, maximumFractionDigits: 6 });
const PERCENT = new Intl.NumberFormat("zh-CN", { useGrouping: false, maximumFractionDigits: 4 });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function blank(value: unknown): boolean { return value === null || value === undefined || value === ""; }
function text(value: unknown, at: string): string | null {
  if (blank(value)) return null;
  if (typeof value === "string") return value;
  throw new ScalarDisplayValueError(`Field "${at}" is declared as text, received ${typeof value}`);
}
function number(value: unknown, at: string): number | null {
  if (blank(value)) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ScalarDisplayValueError(`Field "${at}" is not a finite number: ${String(value)}`);
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
    throw new ScalarDisplayValueError(`Field "${at}" expected a number, received "${value}"`);
  }
  throw new ScalarDisplayValueError(`Field "${at}" expected a number, received ${typeof value}`);
}
function date(value: unknown, at: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new ScalarDisplayValueError(`Field "${at}" is an invalid Date`);
    return value;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ScalarDisplayValueError(`Field "${at}" expected a date, received ${typeof value}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ScalarDisplayValueError(`Field "${at}" is not a recognizable date: ${String(value)}`);
  return parsed;
}
function dateText(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function dateTimeText(value: Date, timeZone: string, seconds: boolean): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12: false }).format(value);
  return `${dateText(value, timeZone)} ${time}`;
}

/** The only implementation of scalar display semantics; a pure function, zero IO. */
export function displayScalarText(field: ScalarDisplayField, value: unknown, context: ScalarDisplayContext): string | null {
  switch (field.type) {
    case "string":
    case "text":
    case "phone":
      return text(value, field.key);
    case "date":
      if (blank(value)) return null;
      return typeof value === "string" && DATE_ONLY.test(value) ? value : dateText(date(value, field.key), context.timeZone);
    case "datetime":
      return blank(value) ? null : dateTimeText(date(value, field.key), context.timeZone, context.datetimeSeconds === true);
    case "number": {
      const parsed = number(value, field.key);
      return parsed === null ? null : NUMBER.format(parsed);
    }
    case "money": {
      const parsed = number(value, field.key);
      return parsed === null ? null : MONEY.format(parsed);
    }
    case "percent": {
      const parsed = number(value, field.key);
      return parsed === null ? null : `${PERCENT.format(parsed)}%`;
    }
    case "bool":
      if (blank(value)) return null;
      if (typeof value !== "boolean") throw new ScalarDisplayValueError(`Field "${field.key}" is declared as bool, received ${typeof value}`);
      return value ? "Yes" : "No";
    case "enum":
    case "ref":
    case "refLine": {
      const raw = text(value, field.key);
      return raw === null ? null : context.label?.(raw) ?? raw;
    }
  }
}
