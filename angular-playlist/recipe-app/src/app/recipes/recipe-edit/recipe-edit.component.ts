import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {RecipeService} from "../recipe.service";
import {Subscription} from "rxjs/Subscription";
import {Recipe} from "../recipe";
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";

@Component({
    selector: 'rb-recipe-edit',
    templateUrl: './recipe-edit.component.html',
    styles: []
})
export class RecipeEditComponent implements OnInit, OnDestroy {
    recipeForm: FormGroup;
    recipeIndex: number;
    private subscription: Subscription;
    private recipe: Recipe;
    private isNew = true;

    constructor(private route: ActivatedRoute,
                private recipesService: RecipeService,
                private formBuilder: FormBuilder,
                private router: Router) {
    }

    ngOnInit() {
        this.subscription = this.route.params.subscribe(
            (params: any) => {
                if (params.hasOwnProperty('id')) {
                    this.isNew = false;
                    this.recipeIndex = +params['id'];
                    this.recipe = this.recipesService.getRecipe(this.recipeIndex);
                } else {
                    this.isNew = true;
                    this.recipe = null;
                }
                this.initForm();
            }
        );
    }

    onCancel() {
        this.navigateBack();
    }

    onSubmit() {
        const newRecipe = this.recipeForm.value;
        if (this.isNew) {
            this.recipesService.addRecipe(newRecipe);
        } else {
            this.recipesService.editRecipe(this.recipe, newRecipe);
        }
        this.navigateBack();
    }

    onAddItem(name: string, amount: string) {
        (<FormArray>this.recipeForm.controls['ingredients']).push(
            new FormGroup({
                name: new FormControl(name, Validators.required),
                amount: new FormControl(amount, [
                    Validators.required,
                    Validators.pattern("\\d+")
                ])
            })
        )
    }

    onRemoveItem(index: number) {
        (<FormArray>this.recipeForm.controls['ingredients']).removeAt(index);
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    private navigateBack() {
        this.router.navigate(['../']);
    }

    private initForm() {
        let recipeName = '',
            recipeImageUrl = '',
            recipeContent = '',
            recipeIngredients: FormArray = new FormArray([]);

        if (!this.isNew) {
            if (this.recipe.hasOwnProperty('ingredients')) {
                this.recipe.ingredients.forEach((value) => {
                    recipeIngredients.push(
                        new FormGroup({
                            name: new FormControl(value.name, Validators.required),
                            amount: new FormControl(value.amount, [Validators.required, Validators.pattern("\\d+")])
                        })
                    );
                });
            }
            recipeName = this.recipe.name;
            recipeImageUrl = this.recipe.imagePath;
            recipeContent = this.recipe.description;
        }
        this.recipeForm = this.formBuilder.group({
            name: [recipeName, Validators.required],
            imagePath: [recipeImageUrl, Validators.required],
            description: [recipeContent, Validators.required],
            ingredients: recipeIngredients
        });

    }
}
