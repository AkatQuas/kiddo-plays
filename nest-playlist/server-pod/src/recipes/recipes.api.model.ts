import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Recipe {
  @Field(type => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true, })
  desciption?: string;

  @Field()
  creationDate: Date;

  @Field(type => [String])
  ingredients: string[];
}
