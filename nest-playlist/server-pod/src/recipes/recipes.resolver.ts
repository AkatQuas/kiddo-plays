import { Resolver, Query, Args, Mutation, Subscription } from '@nestjs/graphql';
import { Recipe } from './recipes.api.model';
import { Inject, NotFoundException } from '@nestjs/common';
import { PubSub } from 'apollo-server-express';
import { RecipesService } from './recipes.service';
import { RecipeArgs } from './recipes.api.args';
import { RecipeInput } from './recipes.api.input';

const pubSub = new PubSub();

@Resolver(of => Recipe)
export class RecipeResolver {
  @Inject()
  private readonly recipesService: RecipesService;

  @Query(returns => Recipe)
  async recipe(@Args('id') id: string): Promise<Recipe> {
    const recipe = await this.recipesService.findOneById(id);
    if (!recipe) {
      throw new NotFoundException(id);
    }
    return recipe;
  }

  @Query(returns => [Recipe])
  async recipes(@Args() recipesArgs: RecipeArgs): Promise<Recipe[]> {
    return this.recipesService.findAll(recipesArgs);
  }

  @Mutation(returns => Recipe)
  async addRecipe(
    @Args('newRecipeData') newRecipeData: RecipeInput
  ): Promise<Recipe> {
    const recipe = await this.recipesService.create(newRecipeData);
    pubSub.publish('recipeAdded', { recipeAdded: recipe });
    return recipe;
  }

  @Mutation(returns => Boolean)
  async removeRecipe(@Args('id') id: string): Promise<boolean> {
    return this.recipesService.remove(id);
  }

  @Subscription(returns => Recipe)
  recipeAdded() {
    return pubSub.asyncIterator('recipeAdded');
  }
}
