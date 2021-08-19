import { GraphQLDefinitionsFactory } from '@nestjs/graphql';
import { resolve } from 'path';

const definitionsFactory = new GraphQLDefinitionsFactory();

definitionsFactory.generate({
  typePaths: ['./src/**/*.graphql'],
  path: resolve(process.cwd(), 'src/graphql.ts'),
  outputAs: 'class',
  watch: true,
  skipResolverArgs: true,
  defaultScalarType: 'unknown',
  customScalarTypeMapping: {
    Date: 'Date',
    DateTime: 'Date',
  },
});
