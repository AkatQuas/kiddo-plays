import {EventEmitter, Injectable} from '@angular/core';
import {Recipe} from "./recipe";
import {Ingredient} from '../shared/ingredient';
import {Headers, Http, Response} from "@angular/http";
import 'rxjs/Rx';
import {Observable} from "rxjs/Observable";

@Injectable()
export class RecipeService {
    recipesChanged = new EventEmitter;
    private recipes: Recipe[] = [
        new Recipe('Dummy', 'Dummy', 'http://icons.iconarchive.com/icons/yohproject/crayon-cute/256/headphone-icon.png', [
            new Ingredient('French Fries', 2),
            new Ingredient('Pork Meat', 1)
        ]),
        new Recipe('Hnjo', 'Lfy', 'http://icons.iconarchive.com/icons/anabellafalivene/cute-folders/512/Folder-Heart-icon.png', []),
        new Recipe('linken', 'kak', 'https://tse2-mm.cn.bing.net/th?id=OIP.2scIyLEwnXd4BDdtuuMIfgEsDL&pid=15.1', [])

    ]

    constructor(private http: Http) {
    }

    getRecipes() {
        return this.recipes;
    }

    getRecipe(id: number) {
        return this.recipes[id];
    }

    deleteRecipe(recipe: Recipe) {
        this.recipes.splice(this.recipes.indexOf(recipe), 1);
    }

    addRecipe(recipe: Recipe) {
        this.recipes.push(recipe);
    }

    editRecipe(oldRecipe: Recipe, newRecipe: Recipe) {
        this.recipes[this.recipes.indexOf(oldRecipe)] = newRecipe;
    }

    storeData() {
        const body = JSON.stringify(this.recipes);
        const headers = new Headers({
            'Content-Type': 'application/json'
        });
        const url = 'url';
        return this.http.post(url, body, {
            headers: headers
        });
    }

    fetchData() {
        const url = 'url';
        return this.http.get(url).map((res: Response) => res.json()).subscribe(
            (data: Recipe[]) => {
                this.recipes = data;
                this.recipesChanged.emit(this.recipes);
            }
        );
    }
}
