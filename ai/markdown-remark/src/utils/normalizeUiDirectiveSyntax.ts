const ATTR_PAIR = /([\w-]+)="([^"]*)"/g;

const LEAF_LINE =
  /^(\s*):::ui-([\w-]+)\s+((?:[\w-]+="[^"]*"\s*)+):::\s*$/;

const OPEN_LINE =
  /^(\s*):::ui-([\w-]+)\s+((?:[\w-]+="[^"]*"\s*)+)$/;

const OPEN_NO_ATTRS = /^(\s*):::ui-([\w-]+)\s*$/;

const CLOSE_LINE = /^\s*:::\s*$/;

function formatAttrs(raw: string): string {
  const pairs: string[] = [];
  let match: RegExpExecArray | null;
  ATTR_PAIR.lastIndex = 0;
  while ((match = ATTR_PAIR.exec(raw)) !== null) {
    pairs.push(`${match[1]}="${match[2]}"`);
  }
  return pairs.join(' ');
}

function escapeDirectivePrefix(line: string): string {
  return line.replace(/^(\s*):::/, '$1\\:\\:\\:');
}

function findContainerClose(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (CLOSE_LINE.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

export function normalizeUiDirectiveSyntax(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    const leafMatch = line.match(LEAF_LINE);
    if (leafMatch) {
      const [, indent, name, attrs] = leafMatch;
      output.push(`${indent}:::ui-${name}{${formatAttrs(attrs)}}`);
      output.push(`${indent}:::`);
      index += 1;
      continue;
    }

    const openWithAttrs = line.match(OPEN_LINE);
    const openNoAttrs = line.match(OPEN_NO_ATTRS);

    if (openWithAttrs || openNoAttrs) {
      const closeIndex = findContainerClose(lines, index);
      if (closeIndex === -1) {
        output.push(escapeDirectivePrefix(line));
        index += 1;
        continue;
      }

      if (openWithAttrs) {
        const [, indent, name, attrs] = openWithAttrs;
        output.push(`${indent}:::ui-${name}{${formatAttrs(attrs)}}`);
      } else if (openNoAttrs) {
        output.push(line);
      }

      index += 1;
      while (index < closeIndex) {
        const innerLine = lines[index];
        const innerLeaf = innerLine.match(LEAF_LINE);
        if (innerLeaf) {
          const [, indent, name, attrs] = innerLeaf;
          output.push(`${indent}:::ui-${name}{${formatAttrs(attrs)}}`);
          output.push(`${indent}:::`);
        } else {
          output.push(innerLine);
        }
        index += 1;
      }

      output.push(lines[closeIndex]);
      index = closeIndex + 1;
      continue;
    }

    output.push(line);
    index += 1;
  }

  return output.join('\n');
}
