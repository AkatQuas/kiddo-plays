/**
 * @file see https://github.com/benspaulding/vscode-procfile/blob/main/src/core/index.ts
 * @summary Procfile module
 * @module procfile
 * @see module:re
 * @description
 * # Anatomy of a Procfile
 *
 * A Procfile has only two kinds of lines:
 *
 * - Process Definitions
 * - Comments (everything that is *not* a Process Definition)
 *
 * ## Anatomy of a Process Definition:
 *
 * ```
 *        web: django-admin runserver
 *        ^ ^^^^                    ^
 *        |_||||____________________|
 *       / | \\______       |       \
 *     /|  |  \\_    \      |        \
 *   /  | name | \ blank?  cmd?       \
 *  |   |     sep \                   |
 *  |   |_________|                   |
 *  |        |                        |
 *  |      intro                      |
 *  |_________________________________|
 *                   |
 *              process def
 * ```
 */

import * as re from './re';

/**
 * A Procfile, in the abstract (think of buffer instead of a file on disk.)
 * The lines offset starts with 0.
 */
export class Procfile {
  readonly lines: Line[];

  /**
   * Create a Procfile
   * @param lines - The lines of text within the Procfile.
   */
  private constructor(...lines: Line[]) {
    this.lines = lines;
  }

  /**
   * Create a Procfile from a block of text.
   * @param text Text to parse.
   */
  static fromString(text: string): Procfile {
    const lines = text.split(/\r?\n/).map((line, i) => new Line(i, line));
    return new Procfile(...lines);
  }

  /** Return the Procfile as a string. */
  toString(): string {
    return this.lines.map((line) => line.val.toString()).join('\n');
  }

  /**
   * Get all of the process definitions within the Procfile.
   * @todo Somehow annotate return value to be Lines whose val is a ProcessDef.
   */
  get processDefLines(): Line[] {
    return this.lines.filter((line) => line.val instanceof ProcessDef);
  }

  /** An array containing tuples of [def, [defWithSameName, ...]]. */
  get conflicts(): [Line, Line[]][] {
    // Save this property because we are going to iterate over it twice.
    const lines = this.processDefLines;

    // Turn the array of lines into an array containing a tuple with ...
    const paired = lines.map((a): [Line, Line[]] => {
      return [
        a,
        lines
          .filter((b) => b !== a)
          .filter(
            (b) => (b.val as ProcessDef).name === (a.val as ProcessDef).name
          ),
      ];
    });

    // Filter down to only lines that actually have conflicts.
    return paired.filter(([, twins]) => twins.length);
  }

  /**
   * Append a raw text this instance.
   * @param text raw text to append.
   * @returns
   */
  appendLine(text: string): Procfile {
    this.lines.push(new Line(this.lines.length, text));
    return this;
  }

  /**
   * Remove a line in this instance, replace it with empty comment.
   * @param predicate line index number or line name string
   */
  removeLine(predicate: number | string): Procfile {
    let index = -1;
    if (typeof predicate === 'number') {
      index = predicate;
    } else if (typeof predicate === 'string') {
      index = this.lines.findIndex(
        (line) => (line.val as ProcessDef).name === predicate
      );
    }
    if (index > -1) {
      this.lines.splice(index, 1);
    }
    return this;
  }

  /**
   * Insert a line before the target line.
   * @param predicate line index number to insert before
   * @returns
   */
  insertLine(predicate: number, text: string): Procfile {
    let index = predicate;
    if (index > -1) {
      this.lines.splice(index, 0, new Line(index, text));
    }
    return this;
  }

  /**
   * Update a line with new Text
   * @param predicate line index number or line name string
   */
  updateLine(predicate: number | string, text: string): Procfile {
    let index = -1;
    if (typeof predicate === 'number') {
      index = predicate;
    } else if (typeof predicate === 'string') {
      index = this.lines.findIndex(
        (line) => (line.val as ProcessDef).name === predicate
      );
    }
    if (index > -1) {
      this.lines.splice(index, 1, new Line(index, text));
    }
    return this;
  }
}

/** A line that is part of a Procfile. */
class Line {
  val: Text;

  /**
   * Create a Line.
   * @param num - Location of the line.
   * @param val - Object representing the contents of the line.
   */
  constructor(readonly num: number, val: string) {
    this.val = ProcessDef.fromString(val);
  }
}

/* A simple line of text. */
interface Text {
  /* @todo Ensure there are no new lines within text. */
  readonly text: string;
}

/** A comment line. */
export class Comment implements Text {
  constructor(readonly text = '') {}
  toString(): string {
    return this.text;
  }
}

/** A process definition line. */
export class ProcessDef implements Text {
  /**
   * Create a ProcessDef.
   * @param text - Exact text used to create the ProcessDef.
   * @param name - Name portion of the process definition.
   * @param sep  - Sep(arator) in the process definition.
   * @param blank - Separating whitespace (blank) in the process definition.
   * @param cmd - Command portion of the process definition.
   */
  private constructor(
    readonly text: string,
    readonly name: string,
    readonly sep: string = re.sep.source,
    readonly blank?: string,
    readonly cmd?: string
  ) {}

  /**
   * Create a ProcessDef or a Comment from a bit of text.
   * @param text Text to prase.
   */
  static fromString(text: string): ProcessDef | Comment {
    const match = text.match(re.PDEF);
    if (match?.groups) {
      const { name, sep, blank, cmd } = match.groups;
      return new ProcessDef(match[0], name, sep, blank, cmd);
    }
    // NOTE: This match/if dance is not necessary, but it feels thorough.
    // It would be nice if just to validate that everything is either a ProcessDef
    // or Comment, and error if not.
    // const comment = text.match(re.IGNORED);
    // if (comment) {
    return new Comment(text);
    // }
  }

  /** Return the ProcessDef as a string. */
  toString(): string {
    const { name, sep, cmd } = this;
    return `${name}${sep} ${cmd}`;
  }

  /**
   * Format a string of text as a process definition, if possible.
   * @param text The text to format
   * @param insertSpace Use a space instead of a tab.
   * @returns The formatted string or `text` untouched.
   */
  static fmtString(text: string, insertSpace = true): string {
    const match = text.match(re.PDEF);
    if (match?.groups) {
      const { name, sep, cmd } = match.groups;
      return `${name}${sep}${insertSpace ? ' ' : ''}${cmd}`;
    }

    return text;
  }
}
