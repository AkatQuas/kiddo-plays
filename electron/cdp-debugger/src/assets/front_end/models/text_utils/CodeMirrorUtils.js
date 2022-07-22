import * as CodeMirror from "../../third_party/codemirror.next/codemirror.next.js";
export function createCssTokenizer() {
  async function tokenize(line, callback) {
    const streamParser = await CodeMirror.cssStreamParser();
    const stream = new CodeMirror.StringStream();
    stream.string = line;
    const startState = streamParser.startState();
    let lastPos = stream.pos;
    while (!stream.eol()) {
      const token = streamParser.token(stream, startState);
      const segment = stream.current().substring(lastPos, stream.pos);
      callback(segment, token);
      lastPos = stream.pos;
    }
  }
  return tokenize;
}
//# sourceMappingURL=CodeMirrorUtils.js.map
