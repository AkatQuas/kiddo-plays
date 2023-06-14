"use strict";
const path = require("path");
const assert = require("yeoman-assert");
const helpers = require("yeoman-test");

describe("generator-npm-ts-package:app", () => {
  beforeAll(() =>
    helpers
      .run(path.join(__dirname, "../app"))
      .withArguments("math-fighter")
      .withPrompts({
        description: "math fighter is a fighter",
        authorName: "Wan",
        authorEmail: "wan@byte.net",
        authorUrl: "https://cn.bing.com",
        keywords: "math,fighter",
      })
  );

  it("creates files", () => {
    assert.file([
      "src/index.ts",
      "src/math.ts",
      "test/math.spec.ts",
      ".mocharc.json",
      "tsconfig.mjs.json",
    ]);
  });

  it("match content", () => {
    assert.fileContent("package.json", '"name": "math-fighter"');
    assert.fileContent(
      "package.json",
      '"description": "math fighter is a fighter"'
    );
    assert.fileContent("README.md", "# math-fighter");
    assert.fileContent("README.md", "> math fighter is a fighter");
  });
});
