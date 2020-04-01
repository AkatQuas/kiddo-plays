import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Grocery } from '../../shared/grocery/grocery';
import { GroceryListService } from '../../shared/grocery/grocery-list.service';
import { TextField } from 'ui/text-field';
import * as SocialShare from 'nativescript-social-share';

@Component({
    selector: 'list',
    moduleId: module.id,
    templateUrl: './list.html',
    styleUrls: ['./list-common.css', './list.css'],
    providers: [GroceryListService]
})
export class ListComponent implements OnInit {
    groceryList: Array<Grocery> = [];
    grocery: string = '';
    isLoading = false;
    listLoaded = false;
    @ViewChild('groceryTextField') groceryTextField: ElementRef;

    constructor(private groceryListService: GroceryListService) { }

    loadList() {
        this.isLoading = true;
        this.groceryListService.load()
            .subscribe(loadedGroceries => {
                loadedGroceries.forEach(o => {
                    this.groceryList.unshift(o);
                })
                this.isLoading = false;
                this.listLoaded = true;
            })
    }
    add() {
        if (this.grocery.trim() === '') {
            return alert('Enter a grocery item');
        }
        // Dismiss the keyboard
        let textField = <TextField>this.groceryTextField.nativeElement;
        textField.dismissSoftInput();

        this.groceryListService.add(this.grocery)
            .subscribe(groceryObj => {
                this.groceryList.unshift(groceryObj);
                this.grocery = '';
            }, _ => {
                alert({
                    message: 'Error to add',
                    okButtonText: 'FiNe'
                })
                this.grocery = '';
            })

    }
    delete(id: string) {
        this.groceryListService.delete(id).subscribe(_ => {
            this.loadList();
        })
    }
    share() {
        let listString = this.groceryList.map(g => g.name).join(', ').trim();
        SocialShare.shareText(listString);
    }
    ngOnInit()  {
        this.loadList();
    }


}
