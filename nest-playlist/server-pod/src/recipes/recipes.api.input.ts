import { Field, InputType } from '@nestjs/graphql';
import { MaxLength, IsOptional, Length } from 'class-validator';

@InputType()
export class RecipeInput {
  @Field()
  @MaxLength(30)
  title: string;

  @Field({ nullable: true, })
  @IsOptional()
  @Length(30, 255)
  description?: string;

  @Field(type => [String])
  ingredients?: string[];

}
