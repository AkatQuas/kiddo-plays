# Rangle.io-ng

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 11.2.1.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Concepts Recap](#concepts-recap)
  - [Content Projection](#content-projection)
  - [ng-template with condition](#ng-template-with-condition)
  - [ng-container with \*ngTemplateOutlet](#ng-container-with-%5Cngtemplateoutlet)
  - [ngSwitch and ng-template](#ngswitch-and-ng-template)
  - [ng-container and ngFor](#ng-container-and-ngfor)
  - [TemplateRef](#templateref)
  - [ViewChild](#viewchild)
  - [ViewChildren](#viewchildren)
  - [ContentChild and ContentChildren](#contentchild-and-contentchildren)
  - [FormGroup with FormControl](#formgroup-with-formcontrol)
  - [ngModelGroup](#ngmodelgroup)
  - [NgModule](#ngmodule)
  - [Directive duplication](#directive-duplication)
- [I18n](#i18n)
- [Development server](#development-server)
- [Code scaffolding](#code-scaffolding)
- [Build](#build)
- [Running unit tests](#running-unit-tests)
- [Running end-to-end tests](#running-end-to-end-tests)
- [Further help](#further-help)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Concepts Recap

### Content Projection

[NgTemplate, NgContainer and NgContent](https://www.freecodecamp.org/news/everything-you-need-to-know-about-ng-template-ng-content-ng-container-and-ngtemplateoutlet-4b7b51223691/)

### ng-template with condition

`[ngIf]` and `*ngIf`

```html
<ng-template [ngIf]="countChange.age > 1">
  <p>Go home!</p>
</ng-template>

<ng-template *ngIf="countChange.age > 1; then goHome"> </ng-template>
<ng-template *ngIf="countChange.age > 3; then goHome; else goHomeElse">
</ng-template>
<ng-template #goHome>
  <p>Go home from template!</p>
</ng-template>
<ng-template #goHomeElse>
  <p>Go Else from template!</p>
</ng-template>
```

### ng-container with \*ngTemplateOutlet

```html
<ng-container *ngTemplateOutlet="goHome"> </ng-container>
<!-- goHome refers to ng-template with #goHome -->
<ng-container *ngTemplateOutlet="goHomeElse"> </ng-container>
<!-- goHome refers to ng-template with #goHomeElse -->
<ng-container *ngTemplateOutlet="parentCount > 1 ? goHomeElse : goHome">
</ng-container>
```

### ngSwitch and ng-template

```html
<div [ngSwitch]="myDir">
  <ng-template [ngSwitchCase]="'east'">
    Go to <b>East</b> Direction
  </ng-template>
  <ng-template [ngSwitchCase]="'west'">
    Go to <b>West</b> Direction
  </ng-template>
  <ng-template [ngSwitchCase]="'north'">
    Go to <b>North</b> Direction
  </ng-template>
  <ng-template [ngSwitchCase]="'south'"
    >Go to <b>South</b> Direction
  </ng-template>
  <ng-template ngSwitchDefault> No Direction </ng-template>
</div>

<div [ngSwitch]="tab">
  <ng-container *ngSwitchCase="1">Tab content 1</ng-container>
  <ng-container *ngSwitchCase="2">Tab content 2</ng-container>
  <ng-container *ngSwitchCase="3"><button>Tab content 3</button></ng-container>
  <ng-container *ngSwitchDefault>Select a tab</ng-container>
</div>
```

### ng-container and ngFor

```html
<ng-container *ngFor="let direction of directions; let index = index">
  <p>Order {{ index }}. Direction : {{ direction }}</p>
</ng-container>

<!-- trackFunction in component.ts -->

<!--
@Component
class NgForComponent {

  trackByDirection(i: number, direction: string) {
    return direction;
  }
}
-->

<!-- start with zero -->
<ng-container
  *ngFor="
      let direction of directions;
      let i = index;
      let isOdd = odd;
      let isEven = even;
      let isFirst = first;
      let isLast = last;
      trackBy: trackByDirection
    "
>
  <p>
    Order {{ i }}. Direction : {{ direction }}, isOdd : {{ isOdd }} , isEven :
    {{ isEven }}, isFirst: {{ isFirst }}, isLast: {{ isLast }}
  </p>
</ng-container>

<ng-template
  ngFor
  [ngForOf]="directions"
  let-direction
  let-i="index"
  let-isOdd="odd"
  let-isEven="even"
  let-isFirst="first"
  let-isLast="last"
  let-trackBy="trackByDirection"
>
  <p [attr.data-direction]="direction" [ngClass]="{ odd: isOdd }">
    {{ i }}. {{ direction }} - isOdd: {{ isOdd }}
  </p>
</ng-template>
```

### TemplateRef

```typescript
@Component({
  selector: 'project-content',
  template: `
    <ng-container *ngTemplateOutlet="headerTemplate"></ng-container>
    <ng-content select="p"></ng-content>
    <ng-container *ngTemplateOutlet="bodyTemplate"></ng-container>
    <ng-content select="button"></ng-content>
  `,
})
export class ProjectContentComponent {
  @Input() headerTemplate: TemplateRef<HTMLElement>;
  @Input() bodyTemplate: TemplateRef<HTMLElement>;
}

// Usage in parent component

@Component({
  template: `
    <ng-template #goHome>
      <p>Go home from template!</p>
    </ng-template>
    <ng-template #goHomeElse>
      <p>Go Else from template!</p>
    </ng-template>
    <project-content [headerTemplate]="goHome" [bodyTemplate]="goHomeElse">
      <p>this is p</p>
      <button>this is button</button>
    </project-content>
  `,
})
export class ParentComponent {}
```

### ViewChild

```typescript
import { Component, ViewChild } from '@angular/core';
import { AlertComponent } from './alert.component';
import { NoticeComponent } from './notice.component';

@Component({
  selector: 'app-root',
  template: `
    <app-alert>My alert</app-alert>
    <app-notice #notice>My Notice</app-notice>
    <button (click)="showAlert()">Show Alert</button>
  `,
})
export class AppComponent {
  // selector by class
  @ViewChild(AlertComponent) alert: AlertComponent;
  // selector by anchor
  @ViewChild('second') alert: NoticeComponent;

  showAlert() {
    this.alert.show();
  }
}
```

### ViewChildren

```typescript
import { Component, QueryList, ViewChildren } from '@angular/core';
import { AlertComponent } from './alert.component';

@Component({
  selector: 'app-root',
  template: `
    <app-alert #first ok="Next" (close)="showAlert(2)">
      Step 1: Learn angular
    </app-alert>
    <app-alert ok="Next" (close)="showAlert(3)">
      Step 2: Love angular
    </app-alert>
    <app-alert ok="Close"> Step 3: Build app </app-alert>
    <button (click)="showAlert(1)">Show steps</button>
  `,
})
export class AppComponent {
  @ViewChild('first') alert: AlertComponent;
  @ViewChildren(AlertComponent) alerts: QueryList<AlertComponent>;
  alertsArr = [];

  ngAfterViewInit() {
    this.alertsArr = this.alerts.toArray();
  }

  showAlert(step) {
    this.alertsArr[step - 1].show(); // step 1 is alert index 0
  }
}
```

### ContentChild and ContentChildren

Retrieve child/children in `<ng-content>` with selector strategy like `@ViewChid` / `@ViewChildren`.

```typescript
@Component({
  selector: 'app-root',
  template: `
    <app-hello-list>
      <app-hello name="World"></app-hello>
      <app-hello name="Other World"></app-hello>
      <app-hello #last name="Last World"></app-hello>
    </app-hello-list>
    <p>Calls function on child component classes to randomize color of them.</p>
  `,
})
export class AppComponent {
  constructor() {}
}

@Component({
  selector: 'app-hello-list',
  template: `
    <p>Projected content:</p>
    <div>
      <!-- children are projected in parent component -->
      <ng-content></ng-content>
    </div>
    <button (click)="onClickAll()">Randomize Hello colors</button>
    <button (click)="onClickLast()">Randomize only last Hello color</button>
  `,
})
export class HelloListComponent {
  @ContentChildren(HelloComponent) helloChildren: QueryList<HelloComponent>;
  @ContentChild('last') lastChild: HelloComponent;

  constructor() {}
  ngAfterContentInit() {
    // Content children now set
    this.onClickAll();
  }

  onClickAll() {
    this.helloChildren.forEach((child) => child.randomizeColor());
  }

  onClickLast() {
    this.lastChild.randomizeColor();
  }
}

@Component({
  selector: 'app-hello',
  template: `<p [ngStyle]="{ color: color }">Hello, {{ name }}!</p>`,
})
export class HelloComponent implements AfterContentInit {
  @Input() name: string;
  color = 'black';

  constructor(private elementRef: ElementRef) {}
  ngAfterContentInit(): void {
    console.log('ref ->', this.elementRef.nativeElement);
  }

  private getRandomColor() {
    const letters = '0123456789ABCDEF'.split('');
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  randomizeColor() {
    this.color = this.getRandomColor();
  }
}
```

### FormGroup with FormControl

```typescript
import { Component } from '@angular/core';
import { Validators, FormBuilder, FormControl } from '@angular/forms';

@Component({
  // ...
})
export class AppComponent {
  // create FormControl in advance
  username = new FormControl('', [
    Validators.required,
    Validators.minLength(5),
  ]);

  // create FormControl in advance
  password = new FormControl('', [Validators.required]);

  public get password2(): AbstractControl {
    return this.loginForm.controls.password;
  }

  loginForm: FormGroup = this.builder.group({
    username: this.username,
    password: this.password,
  });

  constructor(private builder: FormBuilder) {}

  login() {
    console.log(this.loginForm.value);
    // Attempt Logging in...
  }
}
```

### ngModelGroup

```html
<form #paymentForm="ngForm" (ngSubmit)="purchase(paymentForm)">
  <fieldset ngModelGroup="contact">
    <legend>Contact</legend>

    <label> First Name <input type="text" name="firstname" ngModel /> </label>
    <label> Last Name <input type="text" name="lastname" ngModel /> </label>
    <label> Email <input type="email" name="email" ngModel /> </label>
    <label> Phone <input type="text" name="phone" ngModel /> </label>
  </fieldset>

  <fieldset ngModelGroup="address">
    <!-- ... -->
  </fieldset>

  <fieldset ngModelGroup="paymentCard">
    <!-- ... -->
  </fieldset>
</form>
```

### NgModule

As a rule of thumb, **always use the `forRoot` syntax when exporting services from feature modules**, unless you have a very special need that requires multiple instances at different levels of the dependency injection tree.

[More on official documents](https://angular.io/guide/singleton-services#providing-a-singleton-service)

```typescript
@NgModule({
  imports: [CommonModule],
  declarations: [
    /* directives in feature module */
    FeatureModulePipe,
    FeatureModuleComponent,
  ],
  exports: [FeatureModuleComponent],
})
export class FeatureModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: FeatureModule,
      providers: [FeatureModuleService],
    };
  }
}

@NgModule({
  imports: [
    BrowserModule,
    /* import feature module */
    FeatureModule.forRoot(),
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### Directive duplication

we have created two directives that target the same property, `[appHighlight]` for example.

```typescript
// Imports

@NgModule({
  imports: [BrowserModule],
  declarations: [
    AppComponent,
    BlueHighlightDirective /* 1. highlight text to be blue */,
    YellowHighlightDirective /* 2. highlight the background to be yellow */,
    GreenHighlightDirective /* 3. highlight text to be green */,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

When two or more directives target the same element, they are going to be applied in the order they were defined.

## I18n

[Official document](https://angular.io/guide/i18n) explains almost everything on how to localize the application.

When `angular.json` has different locales, the serving command needs some tweaks, [see more](https://stackoverflow.com/a/61122691):

```json
// angular.json
"projects": {
  "app": {
    "i18n": {
      "sourceLocale": "en-US",
      "locales": {
        "zh": "src/locale/messages.zh.xlf"
      }
    },
    "architect": {
      "build": {
        "options": {
          // ...
          "localize": true,
          "i18nMissingTranslation": "warning",
          "aot": true,
        },
        "configuratios": {
          "production": {
            //...
          },
          "en-US": {
            "localize": ["en-US"],
            "baseHref": "/en-US/"
          },
          "zh": {
            "localize": ["zh"],
            "baseHref": "/zh/"
          }
        }
      },
      "serve": {
        "configurations": {
          "production": {
            // ...
          },
          "en-US": {
            "browserTarget": "source:build:en-US"
          },
          "zh": {
            "browserTarget": "source:build:zh"
          }
        }
      }
    }
  }
}
```

```bash
# start in zh
ng serve --configuration=zh

# start in en-US
ng serve --configuration=en-US
```

```typescript
// in component or typescript
window.alert($localize`This shuold be ok`);

// this text will be extracted by @angular/localize
// support i18n in javascript usage
// more at https://angular.io/api/localize/init/$localize
```

Also, we can set the `localize` property to specific locale in `angular.json`, such as `localize: ["zh"]`, [see more](https://angular.io/guide/i18n#generate-app-versions-for-each-locale).

However, HMR in development is not supported. The development procedure looks like:

```
                             ┌──────────────────────┐
                             │ ng extract-i18n      │
┌──────────────────┐         │                      │        ┌────────────┐
│ Develop in       ├────────►│ translation manually ├───────►│ Deploy     │
│   default locale │         │                      │        │      ment  │
└──────────────────┘         │ ng build with locale │        └────────────┘
                             └──────────────────────┘
```

---

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
