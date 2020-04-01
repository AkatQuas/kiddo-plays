import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Min, Max } from 'class-validator';


@ArgsType()
export class RecipeArgs {
  @Field(type => Int)
  @Min(0)
  skip: number = 0;

  @Field(type => Int)
  @Min(0)
  @Max(50)
  limit: number = 25;
}
