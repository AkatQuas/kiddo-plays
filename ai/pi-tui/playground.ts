/**
 * pi-tui Playground — showcases all built-in TUI components and their styles.
 *
 * Interactive: Press Tab to cycle focus (except in Editor), or Ctrl+1~Ctrl+5.
 * Run: npx tsx playground.ts
 */
import { Chalk } from 'chalk';
import {
  Box,
  CombinedAutocompleteProvider,
  Editor,
  type EditorTheme,
  Input,
  Key,
  Loader,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  ProcessTerminal,
  SelectList,
  type SelectItem,
  type SelectListTheme,
  SettingsList,
  type SettingItem,
  type SettingsListTheme,
  Spacer,
  Text,
  TruncatedText,
  TUI,
} from '@earendil-works/pi-tui';

const chalk = new Chalk({ level: 3 });

// ─── Custom themes ──────────────────────────────────────────────────────────

const playgroundSelectListTheme: SelectListTheme = {
  selectedPrefix: (text) => chalk.blueBright(text),
  selectedText: (text) => chalk.bold.white(text),
  description: (text) => chalk.dim.italic(text),
  scrollInfo: (text) => chalk.dim(text),
  noMatch: (text) => chalk.dim.yellow(text),
};

const playgroundMarkdownTheme: MarkdownTheme = {
  heading: (text) => chalk.bold.hex('#FFA500')(text),
  link: (text) => chalk.underline.blue(text),
  linkUrl: (text) => chalk.dim.blue(text),
  code: (text) => chalk.bgHex('#2D2D2D').hex('#FFD700')(text),
  codeBlock: (text) => chalk.hex('#98FB98')(text),
  codeBlockBorder: (text) => chalk.dim(text),
  quote: (text) => chalk.italic.hex('#87CEEB')(text),
  quoteBorder: (text) => chalk.dim.hex('#87CEEB')(text),
  hr: (text) => chalk.dim(text),
  listBullet: (text) => chalk.hex('#FF69B4')(text),
  bold: (text) => chalk.bold(text),
  italic: (text) => chalk.italic(text),
  strikethrough: (text) => chalk.strikethrough(text),
  underline: (text) => chalk.underline(text),
};

const playgroundSettingsListTheme: SettingsListTheme = {
  label: (text, selected) => (selected ? chalk.bold.cyan(text) : chalk.white(text)),
  value: (text, selected) => (selected ? chalk.bold.green(text) : chalk.dim(text)),
  description: (text) => chalk.dim.italic(text),
  cursor: chalk.cyan('❯ '),
  hint: (text) => chalk.dim(text),
};

const playgroundEditorTheme: EditorTheme = {
  borderColor: (text) => chalk.hex('#FFA500')(text),
  selectList: playgroundSelectListTheme,
};

// ─── Create terminal & TUI ──────────────────────────────────────────────────

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

// ─── Helper ─────────────────────────────────────────────────────────────────

let sectionCount = 0;

function addSection(title: string, focusHint?: string): void {
  sectionCount++;
  const label = focusHint
    ? `${chalk.bold.hex('#FFA500')(`■ Section ${sectionCount}: ${title}`)}  ${chalk.dim.italic(focusHint)}`
    : `${chalk.bold.hex('#FFA500')(`■ Section ${sectionCount}: ${title}`)}`;
  tui.addChild(new Text(label, 0, 0));
  tui.addChild(new Spacer(1));
}

function addDivider(): void {
  tui.addChild(new Text(`  ${chalk.dim('─'.repeat(40))}`, 0, 0));
  tui.addChild(new Spacer(1));
}

function addTip(text: string): void {
  tui.addChild(new Text(`  ${chalk.dim(text)}`, 0, 0));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Welcome
// ═══════════════════════════════════════════════════════════════════════════════

tui.addChild(
  new Text(
    chalk.bold.hex('#FFA500')('🎨 pi-tui Playground') +
      '\n' +
      chalk.dim('Tab to cycle focus · Ctrl+1~5 jump · Ctrl+C exit'),
    1,
    1,
  ),
);
tui.addChild(new Spacer(1));
addDivider();

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Text
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Text — Basic Text Display');

tui.addChild(
  new Text(
    chalk.white(
      'Plain text with word wrapping. This line demonstrates how the Text component handles long lines by wrapping them automatically to fit the terminal width.',
    ),
    1,
    0,
  ),
);
tui.addChild(new Spacer(1));

tui.addChild(
  new Text(
    chalk.bold('Styled Text: ') +
      chalk.red('red ') +
      chalk.green('green ') +
      chalk.blue('blue ') +
      chalk.yellow('yellow ') +
      chalk.magenta('magenta ') +
      chalk.cyan('cyan'),
    1,
    0,
  ),
);
tui.addChild(new Spacer(1));

tui.addChild(
  new Text(
    chalk.bgBlue.white.bold('  Blue Background  ') +
      chalk.bgGreen.white.bold('  Green Background  ') +
      chalk.bgRed.white.bold('  Red Background  '),
    1,
    0,
  ),
);
tui.addChild(new Spacer(1));

tui.addChild(new Text(chalk.bold('Text with custom background:'), 1, 1, (text) => chalk.bgHex('#1A1A2E')(text)));
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TruncatedText
// ═══════════════════════════════════════════════════════════════════════════════

addSection('TruncatedText — Single-line Truncation');

tui.addChild(
  new TruncatedText(
    chalk.dim(
      'This is a very long line that will be truncated to fit the viewport width. It is useful for status bars and headers where you do not want wrapping.',
    ),
    1,
    0,
  ),
);
tui.addChild(new Spacer(1));

tui.addChild(
  new TruncatedText(
    chalk.bold.cyan('Status: ') + chalk.green('● Online') + chalk.dim('  |  Mode: Interactive  |  ') + chalk.yellow('⏱ 00:42:15'),
    1,
    0,
  ),
);
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Markdown
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Markdown — Rich Text Rendering');

const markdownContent = [
  '# Markdown Heading',
  '',
  'This is **bold**, *italic*, ~~strikethrough~~, and `inline code`.',
  '',
  '> Blockquote with styled border and italic text',
  '',
  'Code block:',
  '```typescript',
  'function greet(name: string) {',
  '  return `Hello, ${name}!`;',
  '}',
  '',
  'console.log(greet("World"));',
  '```',
  '',
  '- List item with pink bullet',
  '- Another list item',
  '  - Nested item',
  '',
  '[Link example](https://example.com)',
  '',
  '---',
  '',
  'Horizontal rule above with styled divider.',
].join('\n');

tui.addChild(new Markdown(markdownContent, 1, 1, playgroundMarkdownTheme));
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Box
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Box — Container with Padding & Background');

const box = new Box(2, 1, (text) => chalk.bgHex('#16213E')(text));
box.addChild(
  new Text(
    chalk.bold.cyan('Content inside a Box') +
      '\n' +
      chalk.dim('The Box component adds padding and an optional background color.') +
      '\n' +
      chalk.white('It wraps all child components with consistent styling.'),
    1,
    0,
  ),
);
tui.addChild(box);
tui.addChild(new Spacer(1));

const box2 = new Box(2, 1, (text) => chalk.bgHex('#1B4332')(text));
box2.addChild(
  new Text(chalk.bold.green('✓ Success Box') + '\n' + chalk.dim('Different background color for visual distinction.'), 1, 0),
);
tui.addChild(box2);
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SelectList — Interactive
// ═══════════════════════════════════════════════════════════════════════════════

addSection('SelectList — Interactive Selection', 'Ctrl+1 / Tab ↻');

const selectItems: SelectItem[] = [
  { value: 'typescript', label: 'TypeScript', description: 'Typed JavaScript superset' },
  { value: 'python', label: 'Python', description: 'Versatile scripting language' },
  { value: 'rust', label: 'Rust', description: 'Systems programming language' },
  { value: 'go', label: 'Go', description: 'Concurrent language by Google' },
  { value: 'zig', label: 'Zig', description: 'Modern systems programming' },
  { value: 'elixir', label: 'Elixir', description: 'Functional language on BEAM' },
];

const selectList = new SelectList(selectItems, 5, playgroundSelectListTheme);
selectList.onSelect = (item) => {
  editor.setText(`Selected: ${item.label}`);
  editor.disableSubmit = false;
  focusEditor();
};
selectList.onCancel = () => {
  focusEditor();
};
tui.addChild(selectList);
tui.addChild(new Spacer(1));
addTip('↑↓ navigate · Enter select · Esc back to Editor');
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SettingsList — Interactive
// ═══════════════════════════════════════════════════════════════════════════════

addSection('SettingsList — Settings Panel', 'Ctrl+2 / Tab ↻');

const settingsItems: SettingItem[] = [
  {
    id: 'theme',
    label: 'Theme',
    currentValue: 'dark',
    values: ['dark', 'light', 'solarized', 'nord'],
    description: 'Color theme for the application',
  },
  {
    id: 'font-size',
    label: 'Font Size',
    currentValue: '14',
    values: ['12', '13', '14', '16', '18', '20'],
    description: 'Editor font size in pixels',
  },
  {
    id: 'tab-size',
    label: 'Tab Size',
    currentValue: '2',
    values: ['2', '4', '8'],
    description: 'Number of spaces per indentation level',
  },
  {
    id: 'word-wrap',
    label: 'Word Wrap',
    currentValue: 'on',
    values: ['on', 'off'],
    description: 'Wrap long lines in the editor',
  },
  {
    id: 'auto-save',
    label: 'Auto Save',
    currentValue: 'off',
    values: ['off', 'on', 'afterDelay'],
    description: 'Automatically save files',
  },
];

const settingsList = new SettingsList(
  settingsItems,
  6,
  playgroundSettingsListTheme,
  (id, newValue) => {
    editor.setText(`${id} changed to: ${newValue}`);
  },
  () => {
    focusEditor();
  },
);
tui.addChild(settingsList);
tui.addChild(new Spacer(1));
addTip('↑↓ navigate · Enter/Space cycle value · Esc back to Editor');
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Loader — Trigger live
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Loader — Animated Spinner', 'Ctrl+5 / Tab ↻ (auto-triggers)');

const loaderDemo = new Loader(tui, (s) => chalk.hex('#00FFFF')(s), (s) => chalk.dim(s), 'Idle — focus me to start spinner');
tui.addChild(loaderDemo);
tui.addChild(new Spacer(1));
addTip('Focus to start the spinner · auto-stops after 3s');
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Input — Interactive
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Input — Single-line Text Input', 'Ctrl+3 / Tab ↻');

const input = new Input();
input.setValue('Hello, pi-tui!');
input.onSubmit = (value) => {
  editor.setText(`Input submitted: ${value}`);
  focusEditor();
};
tui.addChild(input);
tui.addChild(new Spacer(1));
addTip('Type your text · Enter to submit · Esc back to Editor');
tui.addChild(new Spacer(1));

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Editor — Main input area (default focus)
// ═══════════════════════════════════════════════════════════════════════════════

addSection('Editor — Multi-line Input with Autocomplete', 'Ctrl+4 (default)');

const editor = new Editor(tui, playgroundEditorTheme);

const autocompleteProvider = new CombinedAutocompleteProvider(
  [
    { name: 'help', description: 'Show help information' },
    { name: 'clear', description: 'Clear messages' },
    { name: 'theme', description: 'Change theme' },
    { name: 'exit', description: 'Exit the playground' },
    { name: 'about', description: 'About this playground' },
    { name: 'languages', description: 'List supported languages' },
  ],
  process.cwd(),
);
editor.setAutocompleteProvider(autocompleteProvider);

editor.onSubmit = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '/clear') {
    const children = tui.children;
    while (children.length > 22) {
      children.pop();
    }
    editor.setText('');
    tui.requestRender();
    return;
  }

  const userMsg = new Markdown(`**You said:** ${trimmed}`, 1, 1, playgroundMarkdownTheme);
  const children = tui.children;
  children.splice(children.length - 1, 0, userMsg);

  const thinkLoader = new Loader(tui, (s) => chalk.hex('#FF69B4')(s), (s) => chalk.dim(s), 'Thinking...');
  thinkLoader.start();
  children.splice(children.length - 1, 0, thinkLoader);
  tui.requestRender();

  setTimeout(() => {
    tui.removeChild(thinkLoader);
    const responses = [
      "That's interesting! Let me **think** about that more.\n\n> Reflection is key to understanding.",
      "Great question! Here's what I know:\n\n```\nAnswer: 42\n```\n\n— Some wise words",
      'I see what you mean. Let me break it down:\n\n1. First point\n2. Second point\n3. Third point\n\n---\n\nHope that **helps**!',
      'Fascinating perspective! Have you considered:\n\n- The **alternative** approach?\n- A different *framework*?\n- Performance implications?',
    ];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    const botMsg = new Markdown(randomResponse, 1, 1, playgroundMarkdownTheme);
    children.splice(children.length - 1, 0, botMsg);
    editor.setText('');
    editor.disableSubmit = false;
    tui.requestRender();
  }, 1200);

  editor.setText('');
  editor.disableSubmit = true;
};

tui.addChild(editor);
tui.addChild(new Spacer(1));
addDivider();
tui.addChild(new Text(`  ${chalk.dim('💡 Press Ctrl+C to exit at any time')}`, 0, 0));

// ═══════════════════════════════════════════════════════════════════════════════
// Focus management
// ═══════════════════════════════════════════════════════════════════════════════

const focusableComponents = [selectList, settingsList, input, editor, loaderDemo] as const;
let currentFocusIndex = 3; // Start at Editor

function focusEditor(): void {
  currentFocusIndex = 3;
  tui.setFocus(editor);
}

function focusComponent(index: number): void {
  if (index < 0 || index >= focusableComponents.length) return;
  currentFocusIndex = index;
  tui.setFocus(focusableComponents[index] as any);

  // Special case: Loader — trigger it when focused
  if (index === 4) {
    loaderDemo.setMessage('Running... (auto-stops in 3s)');
    loaderDemo.start();
    setTimeout(() => {
      loaderDemo.stop();
      loaderDemo.setMessage(chalk.green('✓ Loader complete! Press Tab/Ctrl+5 again to re-run'));
      tui.requestRender();
    }, 3000);
  }
}

function cycleFocusForward(): void {
  const next = (currentFocusIndex + 1) % focusableComponents.length;
  focusComponent(next);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Global key handler
// ═══════════════════════════════════════════════════════════════════════════════

tui.addInputListener((data) => {
  if (matchesKey(data, Key.ctrl('c'))) {
    tui.stop();
    process.exit(0);
  }

  // Tab to cycle focus (only when Editor is NOT focused, since Editor uses Tab for autocomplete)
  if (matchesKey(data, Key.tab) && currentFocusIndex !== 3) {
    cycleFocusForward();
    return { consume: true };
  }

  if (matchesKey(data, Key.ctrl('1'))) {
    focusComponent(0);
    return { consume: true };
  }
  if (matchesKey(data, Key.ctrl('2'))) {
    focusComponent(1);
    return { consume: true };
  }
  if (matchesKey(data, Key.ctrl('3'))) {
    focusComponent(2);
    return { consume: true };
  }
  if (matchesKey(data, Key.ctrl('4'))) {
    focusComponent(3);
    return { consume: true };
  }
  if (matchesKey(data, Key.ctrl('5'))) {
    focusComponent(4);
    return { consume: true };
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════════════════════

tui.setFocus(editor);
tui.start();