import * as Marked from "../../third_party/marked/marked.js";
export function resolveLazyDescription(lazyDescription) {
  function linksMap(currentLink) {
    return { link: currentLink.link, linkTitle: currentLink.linkTitle() };
  }
  const substitutionMap = /* @__PURE__ */ new Map();
  lazyDescription.substitutions?.forEach((value, key) => {
    substitutionMap.set(key, value());
  });
  const description = {
    file: lazyDescription.file,
    links: lazyDescription.links.map(linksMap),
    substitutions: substitutionMap
  };
  return description;
}
export async function getFileContent(url) {
  try {
    const response = await fetch(url.toString());
    return response.text();
  } catch (error) {
    throw new Error(`Markdown file ${url.toString()} not found. Make sure it is correctly listed in the relevant BUILD.gn files.`);
  }
}
export async function getMarkdownFileContent(filename) {
  return getFileContent(new URL(`descriptions/${filename}`, import.meta.url));
}
export async function createIssueDescriptionFromMarkdown(description) {
  const rawMarkdown = await getMarkdownFileContent(description.file);
  const rawMarkdownWithPlaceholdersReplaced = substitutePlaceholders(rawMarkdown, description.substitutions);
  return createIssueDescriptionFromRawMarkdown(rawMarkdownWithPlaceholdersReplaced, description);
}
export function createIssueDescriptionFromRawMarkdown(markdown, description) {
  const markdownAst = Marked.Marked.lexer(markdown);
  const title = findTitleFromMarkdownAst(markdownAst);
  if (!title) {
    throw new Error("Markdown issue descriptions must start with a heading");
  }
  return {
    title,
    markdown: markdownAst.slice(1),
    links: description.links
  };
}
const validPlaceholderMatchPattern = /\{(PLACEHOLDER_[a-zA-Z][a-zA-Z0-9]*)\}/g;
const validPlaceholderNamePattern = /PLACEHOLDER_[a-zA-Z][a-zA-Z0-9]*/;
export function substitutePlaceholders(markdown, substitutions) {
  const unusedPlaceholders = new Set(substitutions ? substitutions.keys() : []);
  validatePlaceholders(unusedPlaceholders);
  const result = markdown.replace(validPlaceholderMatchPattern, (_, placeholder) => {
    const replacement = substitutions ? substitutions.get(placeholder) : void 0;
    if (!replacement) {
      throw new Error(`No replacment provided for placeholder '${placeholder}'.`);
    }
    unusedPlaceholders.delete(placeholder);
    return replacement;
  });
  if (unusedPlaceholders.size > 0) {
    throw new Error(`Unused replacements provided: ${[...unusedPlaceholders]}`);
  }
  return result;
}
function validatePlaceholders(placeholders) {
  const invalidPlaceholders = [...placeholders].filter((placeholder) => !validPlaceholderNamePattern.test(placeholder));
  if (invalidPlaceholders.length > 0) {
    throw new Error(`Invalid placeholders provided in the substitutions map: ${invalidPlaceholders}`);
  }
}
export function findTitleFromMarkdownAst(markdownAst) {
  if (markdownAst.length === 0 || markdownAst[0].type !== "heading" || markdownAst[0].depth !== 1) {
    return null;
  }
  return markdownAst[0].text;
}
export async function getIssueTitleFromMarkdownDescription(description) {
  const rawMarkdown = await getMarkdownFileContent(description.file);
  const markdownAst = Marked.Marked.lexer(rawMarkdown);
  return findTitleFromMarkdownAst(markdownAst);
}
//# sourceMappingURL=MarkdownIssueDescription.js.map
