# What is new ?

- Using [angular-in-memory-web-api](https://github.com/angular/in-memory-web-api) for mock data from remote, [service is here](src/app/hero.service.ts) .

- Advanced usage of `rxjs` in [hero search](src/app/hero-search/hero-search.component.ts) component.

    ```ts
    @Component({
        // ...
    })
    export class HeroSearchComponent implements OnInit {

        heroes$: Observable<Hero[]>;
        private searchTerms = new Subject<string>();

        constructor(private heroService: HeroService) { }

        ngOnInit() {
            this.heroes$ = this.searchTerms.pipe(
                debounceTime(600),
                distinctUntilChanged(),
                switchMap((term: string) => this.heroService.searchHeroes(term))
            )
        }
        // event stream
        search(term: string): void {
            this.searchTerms.next(term)
        }
    }
    ```

- [**production budgets**](https://angular.io/guide/build#configure-size-budgets)

- [**proxing to the backend server**](https://angular.io/guide/build#proxying-to-a-backend-server)

- [**usage cheat sheet**](https://angular.io/guide/cheatsheet)

# Configure the file

**IMPORTANT**

[**Config the file `angular.json`**](https://angular.io/guide/workspace-config).

[**The complete schema for `angular.json`](https://github.com/angular/angular-cli/wiki/angular-workspace).

# Assets Usage

The directory `src/app/assets` holds all the **static assets** which will be **copied as-is** when you run `ng build`.

What about those assets used just as `component`?

1. Use it in the style, such as `background-image`, here is an [example](src/app/messages/messages.component.less).

```css
.some-class {
    width: 100px;
    height: 100px;
    background: transparent url('relative/path/from/style/file/to/image') no-repeat center;
    background-size: 100% auto
}
```

1. Use it in the `template syntax`, here is an [example](src/app/messages/messages.component.ts).

```ts
// it is a tricky one
@Component({
    // ...
})
export class MessagesComponent implements OnInit {
    icon = require('relative/path/from/ts/file/to/image');
    //   ...
}
```

# AngularNewTourOfHeroes

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 7.1.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
