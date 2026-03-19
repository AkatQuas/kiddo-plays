// @ts-check

/**
 * Manages intensity values for segments over a number line.
 *
 * Each intensity spans are stored as `[position, intensity]` pairs, where:
 * - position: the starting point of the segment
 * - intensity: the intensity value across the segment
 *
 * @example
 * import { IntensitySegments } from '@tom_ai/intensity';

const segments = new IntensitySegments();

segments.add(10, 30, 1); // Should be "[[10,1],[30,0]]"
segments.add(20, 40, 1); // Should be "[[10,1],[20,2],[30,1],[40,0]]"
 */
export class IntensitySegments {
  /**
   * Restore an instance from ordered breakpoints
   * @param {Array<[number, number]>} breakpoints
   * @returns {IntensitySegments}
   *
   * @example
   * const segments = IntensitySegments.restore_str([[10, 1], [30, 0]]);
   */
  static from(breakpoints) {
    // TODO REFACTOR ↜(ˈ╰ •ω•)╯ψ
    // what if the breakpoints is in random order?
    const x = new IntensitySegments();
    x.#list = breakpoints.slice(0);
    return x;
  }

  /**
   * Restore an instance from breakpoints in string representation
   * @param {string} str breakpoints, trivial space is ignored
   * @returns {IntensitySegments}
   *
   * @example
   * const segments = IntensitySegments.restore_str(`[[10,1],[40,0]]`);
   */
  static from_str(str) {
    const pairs = JSON.parse(str);
    return this.from(pairs);
  }

  /**
   * @type Array<[position:number, intensity: number]>
   * Sorted array of pairs, asc order by `position`
   */
  #list = [];

  /**
   * type guardian for {@link position}
   * @param {number} position
   */
  #assertPosition(position) {
    if (typeof position !== 'number') {
      throw new TypeError('Invalid type: expect position to be a number');
    }
    if (!Number.isFinite(position)) {
      throw new RangeError(
        'Invalid range: expect position to be finite number'
      );
    }
  }

  /**
   * type guardian for {@link intensity}
   * @param {number} intensity
   */
  #assertIntensity(intensity) {
    if (typeof intensity !== 'number') {
      throw new TypeError('Invalid type: expect intensity to be a number');
    }
    if (!Number.isFinite(intensity)) {
      throw new RangeError(
        'Invalid range: expect intensity to be a finite number'
      );
    }
  }

  /**
   * return the index of segment pair that\
   * contains the {@link position} in the {@link #data}
   * @param {number} position
   */
  #findIndex(position) {
    let low = 0,
      high = this.#list.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const pair = this.#list[mid];
      if (pair[0] < position) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  /**
   * Inner function, retrieve the intensity value at {@link position}
   * @param {number} position
   */
  #valueAt(position) {
    const idx = this.#findIndex(position);
    if (idx === 0) {
      return 0;
    }
    return this.#list[idx - 1][1];
  }

  /**
   * Ensure there's a breakpoint at {@link position} with given {@link intensity}\
   * add a new breakpoint when current not exist
   *
   * @param {number} position starting point of segment
   * @param {number} intensity
   */
  #ensureBreakpoint(position, intensity) {
    const idx = this.#findIndex(position);
    if (idx < this.#list.length && this.#list[idx][0] === position) {
      return idx;
    }
    this.#list.splice(idx, 0, [position, intensity]);
    return idx;
  }

  #compress() {
    if (this.#list.length <= 1) {
      return;
    }
    // add the hidden pair
    const ret = [[-Infinity, 0]];

    for (let index = 0; index < this.#list.length; index++) {
      const pair = this.#list[index];
      const last = ret[ret.length - 1];
      if (pair[1] !== last[1]) {
        ret.push(pair);
      }
    }
    //@ts-expect-error suppress tsc error since cannot
    //  cast the type of the hidden pair
    this.#list = ret.slice(1);
  }

  dispose() {
    this.#list.length = 0;
  }

  /**
   * Retrieve the intensity value at {@link position}
   * @param {number} position
   */
  intensityAt(position) {
    return this.#valueAt(position);
  }

  /**
   * Increase or decrease intensity for segment by {@link intensity},\
   * from small side to big one depending on the values of {@link from} and {@link to},\
   * this would take numeric addition the value of given segment.
   * @param {number} from start number
   * @param {number} to end number
   * @param {number} intensity integer changing value, negative is supported
   */
  add(from, to, intensity) {
    this.#assertPosition(from);
    this.#assertPosition(to);
    this.#assertIntensity(intensity);
    if (from === to) {
      return;
    }

    if (from > to) {
      [from, to] = [to, from];
    }

    const valFrom = this.#valueAt(from);
    const valTo = this.#valueAt(to);

    const idxFrom = this.#ensureBreakpoint(from, valFrom);
    const idxTo = this.#ensureBreakpoint(to, valTo);

    // mutate the intensity for all breakpoints
    // between `idxFrom` up to `idxTo - 1`
    for (let index = idxFrom; index < idxTo; index++) {
      this.#list[index][1] += intensity;
    }

    this.#compress();
  }

  /**
   * Set intensity directly from {@link from} to {@link to},\
   * this would overwrite the value of given segment.
   * @param {number} from start number
   * @param {number} to end number
   * @param {number} intensity integer value, negative is supported
   */
  set(from, to, intensity) {
    this.#assertPosition(from);
    this.#assertPosition(to);
    this.#assertIntensity(intensity);
    if (from === to) {
      return;
    }
    if (from > to) {
      [from, to] = [to, from];
    }

    const valFrom = this.#valueAt(from);
    const valTo = this.#valueAt(to);

    const idxFrom = this.#ensureBreakpoint(from, valFrom);
    const idxTo = this.#ensureBreakpoint(to, valTo);

    // remove unnecessary breakpoints between `idxFrom` to `idxTo`
    if (idxTo - idxFrom > 1) {
      this.#list.splice(idxFrom + 1, idxTo - idxFrom - 1);
    }

    // set intensity at `idxFrom`
    this.#list[idxFrom][1] = intensity;

    this.#compress();
  }

  /**
   * Marshal/Serialize this instance to string
   */
  toString() {
    return JSON.stringify(this.#list);
  }
}
