import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Request } from 'express';
import { GraphQLDate, GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
// import { resolve } from 'path';
import { Configuration } from 'src/configuration';
import { DaoModule } from 'src/dao/dao.module';
import { HelloResolver } from 'src/graphql/hello.resolver';
import { NoteResolver } from 'src/graphql/note/note.resolver';
import { UserResolver } from 'src/graphql/user/user.resolver';
import { validateJWT } from 'src/utils';

@Module({
  imports: [
    DaoModule,
    GraphQLModule.forRootAsync({
      useFactory: async (configService: ConfigService<Configuration>) => ({
        useGlobalPrefix: true,
        cors: true,
        playground: configService.get('NODE_ENV') !== 'production',
        typePaths: ['./**/*.graphql'],
        // definitions: {
        //   path: resolve(process.cwd(), 'src/graphql.ts'),
        //   skipResolverArgs: true,
        //   outputAs: 'class',
        // },
        resolvers: {
          JSON: GraphQLJSON,
          Date: GraphQLDate,
          DateTime: GraphQLDateTime,
        },
        context: async (c) => {
          const req = c.req as Request;
          const { operationName } = req.body;
          if (operationName === 'IntrospectionQuery') {
            return {};
          }
          /**
           * @refactor
           * Better session handle
           */
          const token = req.headers.authorization;
          const user = await validateJWT(token);

          return {
            user,
          };
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [HelloResolver, NoteResolver, UserResolver],
  exports: [GraphQLModule],
})
export class GraphqlModule {}
