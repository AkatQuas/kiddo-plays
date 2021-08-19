/**
 * @deprecated old fashion of CustomScalar, check out graphql.module.ts implementation
 */
import { CustomScalar, Scalar } from '@nestjs/graphql';
import {
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
} from 'graphql';
import { GraphQLDate, GraphQLDateTime } from 'graphql-scalars';

@Scalar('Date')
export class DateScalar implements CustomScalar<string, Date> {
  description: string = GraphQLDate.description;
  parseValue: GraphQLScalarValueParser<Date> = GraphQLDate.parseValue;
  serialize: GraphQLScalarSerializer<string> = GraphQLDate.serialize;
  parseLiteral: GraphQLScalarLiteralParser<Date> = GraphQLDate.parseLiteral;
}

/**
 * checkout the types {@link https://github.com/excitement-engineer/graphql-iso-date/blob/master/src/dateTime/index.js implementation}
 */
@Scalar('DateTime')
export class DateTimeScalar implements CustomScalar<string, Date> {
  description?: string = GraphQLDateTime.description;
  parseValue: GraphQLScalarValueParser<Date> = GraphQLDateTime.parseValue;
  serialize: GraphQLScalarSerializer<string> = GraphQLDateTime.serialize;
  parseLiteral: GraphQLScalarLiteralParser<Date> = GraphQLDateTime.parseLiteral;
}
