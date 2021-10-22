// @ts-check

// for javascript jsDoc
/**
 * @typedef  vscodeApi
 * @property {() => Record<string, unknown>} getState
 * @property {(data: Record<string, unknown>) => void} setState
 * @property {(msg: unknown) => void} postMessage
 */

// for typescript

/*
declare module globalThis {
  const acquireVsCodeApi: () => ({
    getState(): { [key: string]: unknown; };
    setState(data: { [key: string]: unknown; }): void;
    postMessage: (msg: unknown) => void;
  });
}
*/

const reModule = (function () {
  const mod = {};

  mod.COMMENT =
    mod.IGNORED =
    mod.PDEF =
    mod.INTRO =
    mod.NAME =
    mod.comment =
    mod.sep =
      void 0;
  const name = /[\w-]+/;
  mod.sep = /:/;
  const blank = /[\t ]+/;
  const cmd = /.+/;
  mod.comment = /#/;
  mod.NAME = new RegExp(re`^(?<name>${name})(?=${mod.sep})`);
  mod.INTRO = new RegExp(
    re`^(?<name>${name})(?<sep>${mod.sep})(?<blank>${blank})?`
  );
  mod.PDEF = new RegExp(
    re`^(?<name>${name})(?<sep>${mod.sep})(?<blank>${blank})?(?<cmd>${cmd})?$`
  );
  mod.IGNORED = new RegExp(re`^(?!${name}${mod.sep}).*$`);
  mod.COMMENT = new RegExp(re`^(?<comment>${mod.comment})$`);
  function re(strings, ...values) {
    function fmt(thusFar, str, i) {
      const val = values[i - 1];
      return `${thusFar}${val instanceof RegExp ? val.source : val}${str}`;
    }
    return strings.reduce(fmt);
  }
  return mod;
})();

const procfileModule = (function () {
  const mod = {};
  class Procfile {
    constructor(...lines) {
      this.lines = lines;
    }
    static fromString(text) {
      const lines = text.split(/\r?\n/).map((line, i) => new Line(i, line));
      return new Procfile(...lines);
    }
    toString() {
      return this.lines.map((line) => line.val.toString()).join('\n');
    }
    get processDefLines() {
      return this.lines.filter((line) => line.val instanceof ProcessDef);
    }
    get conflicts() {
      const lines = this.processDefLines;
      const paired = lines.map((a) => {
        return [
          a,
          lines.filter((b) => b !== a).filter((b) => b.val.name === a.val.name),
        ];
      });
      return paired.filter(([, twins]) => twins.length);
    }
    appendLine(text) {
      this.lines.push(new Line(this.lines.length, text));
      return this;
    }
    removeLine(predicate) {
      return this.updateLine(predicate, '');
    }
    insertLine(predicate, text) {
      let index = predicate;
      if (index > -1) {
        this.lines.splice(index, 0, new Line(index, text));
      }
      return this;
    }
    updateLine(predicate, text) {
      let index = -1;
      if (typeof predicate === 'number') {
        index = predicate;
      } else if (typeof predicate === 'string') {
        index = this.lines.findIndex((line) => line.val.name === predicate);
      }
      if (index > -1) {
        this.lines.splice(index, 1, new Line(index, text));
      }
      return this;
    }
  }
  mod.Procfile = Procfile;
  class Line {
    constructor(num, val) {
      this.num = num;
      this.val = ProcessDef.fromString(val);
    }
  }
  class Comment {
    constructor(text = '') {
      this.text = text;
    }
    toString() {
      return this.text;
    }
  }
  mod.Comment = Comment;
  class ProcessDef {
    constructor(text, name, sep = reModule.sep.source, blank, cmd) {
      this.text = text;
      this.name = name;
      this.sep = sep;
      this.blank = blank;
      this.cmd = cmd;
    }
    static fromString(text) {
      const match = text.match(reModule.PDEF);
      if (match === null || match === void 0 ? void 0 : match.groups) {
        const { name, sep, blank, cmd } = match.groups;
        return new ProcessDef(match[0], name, sep, blank, cmd);
      }
      return new Comment(text);
    }
    toString() {
      const { name, sep, cmd } = this;
      return `${name}${sep} ${cmd}`;
    }
    static fmtString(text, insertSpace = true) {
      const match = text.match(reModule.PDEF);
      if (match === null || match === void 0 ? void 0 : match.groups) {
        const { name, sep, cmd } = match.groups;
        return `${name}${sep}${insertSpace ? ' ' : ''}${cmd}`;
      }
      return text;
    }
  }
  mod.ProcessDef = ProcessDef;
  return mod;
})();

(function () {
  // @ts-ignore
  const /** @type {vscodeApi} */ vscode = window.acquireVsCodeApi();

  const lineContainer = /** @type {HTMLElement} */ (
    document.querySelector('.lines')
  );

  const appendButton = document.querySelector('.append-button');
  appendButton.querySelector('button').addEventListener('click', () => {
    vscode.postMessage({
      type: 'append',
    });
  });

  const errorContainer = document.querySelector('.error');

  /**
   * Render the document in the webview.
   */
  function updateContent(/** @type {string} */ text) {
    if (!text) {
      text = '';
    }
    const procfile = procfileModule.Procfile.fromString(text);

    const children = procfile.lines.map((line) => {
      if (line.val instanceof procfileModule.ProcessDef) {
        return processLine(line);
      }
      return commentLine(line);
    });

    lineContainer.replaceChildren(...children);
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'update':
        const text = message.text;
        // Update webview display
        updateContent(text);

        // Persis stat information.
        vscode.setState({ text });
        return;
      default:
        console.log(`Unhandled message type: "${message.type}"`);

        return;
    }
  });

  // Webviews are normally torn down when not visible an re-created when they become visible again.
  // State lets us save information across these re-loads;
  const state = vscode.getState();
  if (state) {
    updateContent(state.text);
  }

  function commentLine(line) {
    const div = document.createElement('div');
    div.className = 'line comment';
    div.innerText = line.val.text;
    if (line.val.text.trim() === '') {
      div.classList.add('empty-comment');
    }
    suffixActionButton(div, line);
    return div;
  }

  function processLine(line) {
    const div = document.createElement('div');
    div.className = 'line process';

    const name = document.createElement('span');
    name.className = 'name';
    name.innerText = line.val.name;
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.innerText = line.val.sep;
    const command = document.createElement('span');
    command.className = 'command';
    command.innerText = line.val.cmd;

    div.append(name, sep, command);
    suffixActionButton(div, line);

    return div;
  }

  function suffixActionButton(/** @type {HTMLElement} */ element, line) {
    const num = line.num;
    const text = line.val.text;
    const div = document.createElement('div');
    div.className = 'action';

    const updateButton = document.createElement('button');
    updateButton.className = 'action-button';
    updateButton.title = 'Update';
    updateButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'update',
        predicate: num,
        text: text,
      });
    });
    div.appendChild(updateButton);

    const insertButton = document.createElement('button');
    insertButton.className = 'action-button';
    insertButton.title = 'Insert';
    insertButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'insert',
        predicate: num,
      });
    });
    div.appendChild(insertButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button';
    deleteButton.title = 'Delete';
    deleteButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'remove',
        predicate: num,
      });
    });
    div.appendChild(deleteButton);

    element.appendChild(div);
  }
})();
