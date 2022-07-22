import { parseList, ResultKind, serializeItem, serializeList } from "./StructuredHeaders.js";
export function parseBrandsList(stringForm, parseErrorString, structErrorString) {
  const brandList = [];
  const parseResult = parseList(stringForm);
  if (parseResult.kind === ResultKind.ERROR) {
    return parseErrorString;
  }
  for (const listItem of parseResult.items) {
    if (listItem.kind !== ResultKind.ITEM) {
      return structErrorString;
    }
    const bareItem = listItem.value;
    if (bareItem.kind !== ResultKind.STRING) {
      return structErrorString;
    }
    if (listItem.parameters.items.length !== 1) {
      return structErrorString;
    }
    const param = listItem.parameters.items[0];
    if (param.name.value !== "v") {
      return structErrorString;
    }
    const paramValue = param.value;
    if (paramValue.kind !== ResultKind.STRING) {
      return structErrorString;
    }
    brandList.push({ brand: bareItem.value, version: paramValue.value });
  }
  return brandList;
}
export function serializeBrandsList(brands) {
  const shList = { kind: ResultKind.LIST, items: [] };
  const vParamName = { kind: ResultKind.PARAM_NAME, value: "v" };
  for (const brand of brands) {
    const nameString = { kind: ResultKind.STRING, value: brand.brand };
    const verString = { kind: ResultKind.STRING, value: brand.version };
    const verParams = {
      kind: ResultKind.PARAMETERS,
      items: [{ kind: ResultKind.PARAMETER, name: vParamName, value: verString }]
    };
    const shItem = { kind: ResultKind.ITEM, value: nameString, parameters: verParams };
    shList.items.push(shItem);
  }
  const serializeResult = serializeList(shList);
  return serializeResult.kind === ResultKind.ERROR ? "" : serializeResult.value;
}
export function validateAsStructuredHeadersString(value, errorString) {
  const parsedResult = serializeItem({
    kind: ResultKind.ITEM,
    value: { kind: ResultKind.STRING, value },
    parameters: { kind: ResultKind.PARAMETERS, items: [] }
  });
  if (parsedResult.kind === ResultKind.ERROR) {
    return { valid: false, errorMessage: errorString };
  }
  return { valid: true, errorMessage: void 0 };
}
//# sourceMappingURL=UserAgentMetadata.js.map
