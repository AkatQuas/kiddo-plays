// @ts-check

import assert from 'node:assert';
import { afterEach, beforeEach, suite, test } from 'node:test';
import { IntensitySegments } from '../src/index.mjs';

suite('Basic Check', () => {
  /** @type {IntensitySegments} */
  let segments;
  beforeEach(() => {
    segments = new IntensitySegments();
  });
  afterEach(() => {
    segments.dispose();
  });

  test('expect the initial value to be 0', () => {
    assert.equal(segments.toString(), '[]');
  });

  test('type guardian for position', () => {
    assert.throws(
      () =>
        segments.add(
          // @ts-expect-error
          '1',
          2,
          1
        ),
      'position to be a number'
    );
    assert.throws(
      () =>
        segments.add(
          2,
          // @ts-expect-error
          '1',
          1
        ),
      'position to be a number'
    );
    assert.throws(
      () => segments.add(2, Infinity, 1),
      'position to be finite number'
    );
    assert.throws(
      () => segments.add(-Infinity, 2, 1),
      'position to be finite number'
    );
  });

  test('type guardian for intensity', () => {
    assert.throws(
      () =>
        segments.add(
          2,
          1,
          // @ts-expect-error
          '1'
        ),
      'intensity to be a number'
    );
    assert.throws(
      () => segments.add(2, 1, Infinity),
      'intensity to be a number'
    );
    assert.throws(
      () => segments.add(2, 1, -Infinity),
      'intensity to finite number'
    );
  });
});

suite('Simple usage', () => {
  /** @type {IntensitySegments} */
  let segments;
  beforeEach(() => {
    segments = new IntensitySegments();
  });
  afterEach(() => {
    segments.dispose();
  });

  test('setting intensity directly works', () => {
    segments.set(17, 42, 1);
    assert.equal(segments.toString(), '[[17,1],[42,0]]');
  });
  test('setting intensity in reverse order also works', () => {
    segments.set(73, 17, 1);
    assert.equal(segments.toString(), '[[17,1],[73,0]]');
  });

  test('adding intensity works', () => {
    segments.add(17, 42, 1);
    assert.equal(segments.toString(), '[[17,1],[42,0]]');
  });

  test('adding intensity in reverse order also works', () => {
    segments.add(73, 42, 1);
    assert.equal(segments.toString(), '[[42,1],[73,0]]');
  });

  test('intensityAt() works', () => {
    segments.add(10, 30, 2);
    assert.equal(segments.intensityAt(12), 2);
    assert.equal(segments.intensityAt(20), 2);
    segments.add(20, 25, -1);
    assert.equal(segments.intensityAt(15), 2);
    assert.equal(segments.intensityAt(22), 1);
    assert.equal(segments.intensityAt(27), 2);
  });
});

suite('Complex usage', () => {
  /** @type {IntensitySegments} */
  let segments;
  beforeEach(() => {
    segments = new IntensitySegments();
  });
  afterEach(() => {
    segments.dispose();
  });

  test('cancelling out intensity works', () => {
    segments.add(0, 15, 2);
    assert.equal(segments.toString(), '[[0,2],[15,0]]');
    segments.add(0, 15, -2);
    assert.equal(segments.toString(), '[]');
  });

  test('operating the intensity several times also works', () => {
    segments.add(17, 42, 1);
    segments.add(23, 49, 1);
    assert.equal(segments.toString(), '[[17,1],[23,2],[42,1],[49,0]]');

    segments.add(97, 41, -2);
    assert.equal(
      segments.toString(),
      '[[17,1],[23,2],[41,0],[42,-1],[49,-2],[97,0]]'
    );
  });

  test('verify the readme explanation', () => {
    segments.add(10, 30, 1);
    assert.equal(segments.toString(), '[[10,1],[30,0]]');

    segments.add(20, 40, 1);
    assert.equal(segments.toString(), '[[10,1],[20,2],[30,1],[40,0]]');

    segments.add(5, 35, -2);
    assert.equal(
      segments.toString(),
      '[[5,-2],[10,-1],[20,0],[30,-1],[35,1],[40,0]]'
    );
  });
});

suite('Restoration', () => {
  /** @type {IntensitySegments} */
  let segments;
  afterEach(() => {
    segments.dispose();
  });

  test('restore from breakpoints pairs', () => {
    segments = IntensitySegments.from([
      [10, 1],
      [30, 0],
    ]);

    assert.equal(segments.toString(), '[[10,1],[30,0]]');

    segments.add(20, 40, 1);
    assert.equal(segments.toString(), '[[10,1],[20,2],[30,1],[40,0]]');
  });

  test('restore from breakpoints in string format', () => {
    segments = IntensitySegments.from_str('[[10,1],[30,0]]');

    assert.equal(segments.toString(), '[[10,1],[30,0]]');

    segments.add(20, 40, 1);
    assert.equal(segments.toString(), '[[10,1],[20,2],[30,1],[40,0]]');
  });
});
