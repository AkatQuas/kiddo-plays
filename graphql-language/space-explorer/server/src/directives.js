const {
  SchemaDirectiveVisitor,
  GraphQLField,
  GraphQLEnumValue,
} = require('apollo-server');
const { defaultFieldResolver, GraphQLString } = require('graphql');

// Create (or import) a custom schema directive
module.exports.UpperCaseDirective = class UpperCaseDirective extends (
  SchemaDirectiveVisitor
) {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    field.resolve = async function (...args) {
      const result = await resolve.apply(this, args);
      if (typeof result === 'string') {
        return result.toUpperCase();
      }
      return result;
    };
  }
};

module.exports.DeprecatedDirective = class DeprecatedDirective extends (
  SchemaDirectiveVisitor
) {
  /**
   *
   * @param {GraphQLField<any, any>} field
   */
  visitFieldDefinition(field) {
    field.isDeprecated = true;
    field.deprecationReason = this.args.reason;
  }

  /**
   *
   * @param {GraphQLEnumValue} value
   */
  visitEnumValue(value) {
    value.isDeprecated = true;
    value.deprecationReason = this.args.reason;
  }
};

module.exports.RestDirective = class RestDirective extends (
  SchemaDirectiveVisitor
) {
  /**
   *
   * @param {GraphQLField<any, any>} field
   */
  visitFieldDefinition(field) {
    const { url } = this.args;
    field.resolve = () => fetch(url);
  }
};

module.exports.DateFormatDirective = class DateFormatDirective extends (
  SchemaDirectiveVisitor
) {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    const { format } = this.args;
    field.resolve = async function (...args) {
      const date = await resolve.apply(this, args);
      return require('dateformat')(date, format);
    };
    // The formatted Date becomes a String, so the field type must change:
    field.type = GraphQLString;
  }
};
