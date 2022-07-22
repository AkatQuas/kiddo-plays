export function getCssDeclarationAsJavascriptProperty(declaration) {
  const { name, value } = declaration;
  const declarationNameAsJs = name.startsWith("--") ? `'${name}'` : name.replace(/-([a-z])/gi, (_str, group) => group.toUpperCase());
  const declarationAsJs = `'${value.replaceAll("'", "\\'")}'`;
  return `${declarationNameAsJs}: ${declarationAsJs}`;
}
//# sourceMappingURL=StylePropertyUtils.js.map
