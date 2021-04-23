import { getDirectives, MapperKind, mapSchema } from '@graphql-tools/utils';
import formatDate from 'dateformat';
import { defaultFieldResolver, GraphQLSchema, GraphQLString } from 'graphql';

/**
 *
 * @param {string} directiveName
 * @returns
 */
export function deprecatedDirective(directiveName: string) {
  return {
    deprecatedDirectiveTypeDefs: `directive @${directiveName}(reason: String) on FIELD_DEFINITION | ENUM_VALUE`,
    deprecatedDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            fieldConfig.deprecationReason = directiveArgumentMap.reason;
            return fieldConfig;
          }
        },
        [MapperKind.ENUM_VALUE]: (enumValueConfig) => {
          const directives = getDirectives(schema, enumValueConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            enumValueConfig.deprecationReason = directiveArgumentMap.reason;
            return enumValueConfig;
          }
        },
      }),
  };
}

export function upperDirective(directiveName: string) {
  return {
    upperDirectiveTypeDefs: `directive @${directiveName} on FIELD_DEFINITION`,
    upperDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          if (directives[directiveName]) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            fieldConfig.resolve = async function (source, args, context, info) {
              const result = await resolve(source, args, context, info);
              if (typeof result === 'string') {
                return result.toUpperCase();
              }
              return result;
            };
            return fieldConfig;
          }
        },
      }),
  };
}

export function dateDirective(directiveName: string) {
  return {
    dateDirectiveTypeDefs: `directive @${directiveName}(format: String) on FIELD_DEFINITION`,
    dateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            const { format } = directiveArgumentMap;
            fieldConfig.resolve = async function (source, args, context, info) {
              const date = await resolve(source, args, context, info);
              return formatDate(date, format, true);
            };
            return fieldConfig;
          }
        },
      }),
  };
}

export function formattableDateDirective(directiveName: string) {
  return {
    formattableDateDirectiveTypeDefs: `directive @${directiveName}(
        defaultFormat: String = "mmmm d, yyyy"
      ) on FIELD_DEFINITION
    `,
    formattableDateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            const { defaultFormat } = directiveArgumentMap;

            fieldConfig.args['format'] = {
              type: GraphQLString,
            };

            fieldConfig.type = GraphQLString;
            fieldConfig.resolve = async function (
              source,
              { format, ...args },
              context,
              info
            ) {
              const newFormat = format || defaultFormat;
              const date = await resolve(source, args, context, info);
              return formatDate(date, newFormat, true);
            };
            return fieldConfig;
          }
        },
      }),
  };
}
