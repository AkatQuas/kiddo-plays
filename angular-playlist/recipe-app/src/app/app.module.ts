import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HttpModule} from "@angular/http";

import {AppComponent} from './app.component';
import {HeaderComponent} from './header/header.component';
import {RecipesComponent} from './recipes/recipes.component';
import {RecipeListComponent} from './recipes/recipt-list/recipe-list.component';
import {RecipeItemComponent} from './recipes/recipt-list/recipe-item.component';
import {RecipeDetailComponent} from './recipes/recipe-detail/recipe-detail.component';
import {ShoppingListComponent} from './shopping-list/shopping-list.component';
import {ShoppingListAddComponent} from './shopping-list/shopping-list-add.component';
import {DropdownDirective} from './shared/dropdown.directive';
import {ShoppingListService} from "./shopping-list/shopping-list.service";
import {AppRoutesModule} from "./routes/app-routes.module";
import {RecipeStartComponent} from "./recipes/recipe-start.component";
import {RecipeEditComponent} from "./recipes/recipe-edit/recipe-edit.component";

@NgModule({
    declarations: [
        AppComponent,
        HeaderComponent,
        RecipesComponent,
        RecipeListComponent,
        RecipeItemComponent,
        RecipeDetailComponent,
        ShoppingListComponent,
        ShoppingListAddComponent,
        DropdownDirective,
        RecipeStartComponent,
        RecipeEditComponent
    ],
    imports: [
        BrowserModule, AppRoutesModule, FormsModule, ReactiveFormsModule,
        HttpModule
    ],
    providers: [ShoppingListService],
    bootstrap: [AppComponent]
})
export class AppModule {
}
