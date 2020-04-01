import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipeResolver } from './recipes.resolver';
import { DateScalar } from '../common/scalars/date.scalar';

@Module({
  providers: [RecipeResolver, RecipesService, DateScalar]
})
export class RecipesModule { }
