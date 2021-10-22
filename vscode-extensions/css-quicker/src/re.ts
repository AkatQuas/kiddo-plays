const IDLeading = /#/;
const ClassLeading = /\./;
const Boundary = /\b/;
const Identifier = /(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/;

export const ClassSelectorString = re`${ClassLeading}${Identifier}${Boundary}`;
export const IDSelectorString = re`${IDLeading}${Identifier}${Boundary}`;

/**
 * @see https://github.com/benspaulding/vscode-procfile/blob/b1ddcf5c349acaa005fabdcf7111f34443d552f3/src/core/re.ts#L58-L85
 * Use RegExp.source if a RegExp appears as value in tagged a template literal.
 * @param {TemplateStringsArray} strings - Static string bits within the template literal.
 * @param {...any} [values] - Dynamic values within the template literal.
 * @returns {string} - Fully processed template literal.
 * @access package
 * @example
 * const mine = /^my /;
 * const regexp = new RegExp(re`${mine}.*$`)
 * const match = 'my text'.match(regexp)
 */
export function re(strings: TemplateStringsArray, ...values: (RegExp | string)[]): string {
    /**
     * A reduce callback for working with tagged template literals.
     * @param thusFar - Accumulator containing the string thus far.
     * @param str - Current value being reduced.
     * @param i - Index of the current value being reduced.
     * @access private
     */
    function fmt(thusFar: string, str: string, i: number): string {
        const val = values[i - 1];
        return `${thusFar}${val instanceof RegExp ? val.source : val}${str}`;
    }

    // Do not pass an initialValue to reduce -- strings is always one longer than values
    // and our callback uses that to its advantage.
    return strings.reduce(fmt);
}

export function IDSelector(id: string): RegExp {
    return new RegExp(re`${IDLeading}${id}${Boundary}`);
}

export function ClassSelector(cls: string): RegExp {
    return new RegExp(re`${ClassLeading}${cls}${Boundary}`);
}
