export class IdentityFormatter {
  constructor(builder) {
    this.builder = builder;
  }
  format(text, lineEndings, fromOffset, toOffset) {
    const content = text.substring(fromOffset, toOffset);
    this.builder.addToken(content, fromOffset);
  }
}
//# sourceMappingURL=IdentityFormatter.js.map
