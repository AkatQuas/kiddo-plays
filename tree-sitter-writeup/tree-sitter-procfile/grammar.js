module.exports = grammar({
  name: 'procfile',

  // these are the nodes for the hand-written parsing rule to consume
  extras: ($) => [/\s+/, $.line_continuation],

  // the parsing rules
  rules: {
    program: ($) => repeat(seq(choice($.instruction, $.comment), '\n')),

    instruction: ($) =>
      seq(field('name', $.id), ':', field('body', $.commands)),

    id: ($) => /[-a-zA-Z0-9_]+/,
    commands: ($) => /.*/,

    line_continuation: ($) => '\\\n',
    // comment: ($) =>
    //   seq('#', /[^:]*(?=\n)/),
    //                  ^^^
    //                  error: look-around, including look-ahead and look-behind, is not supported
    comment: ($) => seq('#', /.*/),
  },
});
