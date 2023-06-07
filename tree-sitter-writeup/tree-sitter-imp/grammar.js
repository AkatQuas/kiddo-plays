module.exports = grammar({
  name: 'imp',

  // these are the nodes for the hand-written parsing rule to consume
  extras: ($) => [/\s/, $.comment],

  //
  conflicts: ($) => [],

  // the parsing rules
  rules: {
    program: ($) => choice($.stmt, $.comment),
    stmt: ($) => choice($.skip, $.asgn, $.seq, $.if, $.while),
    skip: ($) => 'skip',
    asgn: ($) => seq(field('name', $.id), ':=', $._aexp),
    id: ($) => /[a-z]+/,
    seq: ($) => prec.right(1, seq($.stmt, ';', $.stmt, optional(';'))),
    if: ($) =>
      seq(
        'if',
        field('condition', $._bexp),
        'then',
        field('consequent', $.stmt),
        'else',
        field('alternative', $.stmt),
        'end'
      ),
    while: ($) =>
      seq(
        'while',
        field('condition', $._bexp),
        'do',
        field('body', $.stmt),
        'end'
      ),

    /* arithmetic expressions */
    _aexp: ($) =>
      choice($.num, $.id, $.plus, $.minus, $.times, seq('(', $._aexp, ')')),
    num: ($) => /[0-9]+/,
    plus: ($) => prec.left(1, seq($._aexp, '+', $._aexp)),
    minus: ($) => prec.left(1, seq($._aexp, '-', $._aexp)),
    times: ($) => prec.left(2, seq($._aexp, '*', $._aexp)),

    /* boolean expression */
    _bexp: ($) =>
      choice(
        'true',
        'false',
        $.eqb,
        $.leb,
        $.negb,
        $.andb,
        seq('(', $._bexp, ')')
      ),
    eqb: ($) => seq($._aexp, '=', $._aexp),
    leb: ($) => seq($._aexp, '=<', $._aexp),
    negb: ($) => prec.right(2, seq('~', $._bexp)),
    andb: ($) => prec.right(1, seq($._bexp, '&&', $._bexp)),

    comment: ($) => token(seq('//', /.*/)),
  },
});
