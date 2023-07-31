const Ajv = require('ajv');
const betterAjvErrors = require('better-ajv-errors');
const { schema } = require('./schema');

const ajv = new Ajv({ $data: true, strict: false });

/**
 * allow additionalProperties in runtime check, but not allow in vscode $schema
 */
function patchSchemaAdditionalProperties(jsonSchema) {
  for (const key of Object.keys(jsonSchema)) {
    if (key === 'additionalProperties' && jsonSchema[key] === false) {
      // jsonSchema[key] = true;
    }

    if (typeof jsonSchema[key] === 'object' && jsonSchema[key] !== null) {
      patchSchemaAdditionalProperties(jsonSchema[key]);
    }
  }
}

function validateConfigWithSchema(jsonConfig, jsonSchema) {
  patchSchemaAdditionalProperties(jsonSchema);

  const validate = ajv.compile(jsonSchema);
  const valid = validate(jsonConfig);

  if (valid) {
    return { valid: true, errors: '' };
  }

  if (validate.errors?.length) {
    const errors = betterAjvErrors.default(
      jsonSchema,
      jsonConfig,
      validate.errors.map((e) => ({
        ...e,
        dataPath: e.instancePath,
      })),
      {
        indent: 2,
      }
    );

    return { valid: false, errors };
  }

  throw Error('Disaster happens');
}

const { valid, errors } = validateConfigWithSchema(
  {
    amount: 10,
    list: [
      {
        name: 'h',
        age: 1,
        // weapon: 'axe',
        wings: '2',
      },
      // {
      //   name: 'h',
      //   age: 1,
      //   wings: true,
      // },
    ],
  },
  schema
);
if (valid) {
} else {
  console.debug('\x1B[97;101;1m --- errors --- \x1B[m', '\n', errors);
}
