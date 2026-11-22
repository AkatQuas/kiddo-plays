import { describe, expect, it } from "vitest";
import {
  APPLICATION_CODE_PATTERN,
} from "../src/index.js";

describe("stable product application codes", () => {
  it("accepts only a lowercase kebab code", () => {
    expect(APPLICATION_CODE_PATTERN.test("boss-mobile")).toBe(true);
    expect(APPLICATION_CODE_PATTERN.test("report2-mobile")).toBe(true);
  });

  it.each(["Boss-mobile", "boss_mobile", "boss--mobile", "boss-mobile ", "-boss", "boss-"])(
    "rejects an unstable application code: %s",
    (code) => expect(APPLICATION_CODE_PATTERN.test(code)).toBe(false),
  );
});
