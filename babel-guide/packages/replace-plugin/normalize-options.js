const { OptionValidator } = require('@babel/helper-validator-option');
const v = new OptionValidator('babel-plugin-replace-plugin');

/**
 *
 * @param {object} options
 * @param {string} [options.sourceIdentifier]
 * @param {string} [options.targetIdentifier]
 * @returns {{ sourceIdentifier: string; targetIdentifier: string }}
 */
function normalizeOptions(options = {}) {
  const sourceIdentifier = v.validateStringOption(
    'sourceIdentifier',
    options.sourceIdentifier,
    'number'
  );
  const targetIdentifier = v.validateStringOption(
    'targetIdentifier',
    options.targetIdentifier,
    'not_number'
  );
  return {
    sourceIdentifier,
    targetIdentifier,
  };
}

module.exports = normalizeOptions;
