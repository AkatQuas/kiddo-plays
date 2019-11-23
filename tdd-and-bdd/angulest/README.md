# Angulest

Angular has a comprehensive document illustrating testing for us, [here](https://angular.io/guide/testing).

### Testing Utility APIs

[The Angular testing utilities](https://angular.io/guide/testing#testing-utility-apis) include the TestBed, the ComponentFixture, and a handful of functions that control the test environment.

### TestBed

[TestBed](https://angular.io/guide/testing#testing-services-with-the-testbed) helps to provide and create services.

Sometimes we use `setup` function instead of `beforeEach()`, this is an alternative way.

```ts
function setup() {
  const valueServiceSpy =
    jasmine.createSpyObj('ValueService', ['getValue']);
  const stubValue = 'stub value';
  const masterService = new MasterService(valueServiceSpy);

  valueServiceSpy.getValue.and.returnValue(stubValue);
  return { masterService, stubValue, valueServiceSpy };
}

it('#getValue should return stubbed value from a spy', () => {
  // call `setup` in every `it` function
  const { masterService, stubValue, valueServiceSpy } = setup();
  expect(masterService.getValue())
    .toBe(stubValue, 'service returned stub value');
  expect(valueServiceSpy.getValue.calls.count())
    .toBe(1, 'spy method was called once');
  expect(valueServiceSpy.getValue.calls.mostRecent().returnValue)
    .toBe(stubValue);
});
```

### Inject a spy providers

[Here is an example](src/app/hero.service.spec.ts).

```ts
describe('HeroService', () => {
  let httpClientSpy: { get: jasmine.Spy };

  beforeEach(() => {
    httpClientSpy = jasmine.createSpyObj('HttpClient', ['get']);
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpClientSpy }
      ]
    });
  });
  //...
});
```

### Test a variable instanceof Interface

**NOPE!** It's not possible to check whether a variable matches certain interfaces during the run time!

The editor helps during the coding time.

### DOM testing

[link](https://angular.io/guide/testing#component-dom-testing).

```ts
// minimal test
describe('BannerComponent (minimal)', () => {
  it('should create', () => {
    TestBed.configureTestingModule({
      declarations: [ BannerComponent ]
    });
    const fixture = TestBed.createComponent(BannerComponent);
    const component = fixture.componentInstance;
    expect(component).toBeDefined();
  });
});

// cli test
describe('BannerComponent (with beforeEach)', () => {
  let component: BannerComponent;
  let fixture: ComponentFixture<BannerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ BannerComponent ]
    });
    fixture = TestBed.createComponent(BannerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });
});
```

[NativeElement](https://angular.io/guide/testing#nativeelement), [DebugElment](https://angular.io/guide/testing#debugelement).

> Angular relies on the `DebugElement` abstraction to work safely across _all_ supported platforms. Instead of creating an HTML element tree, Angular creates a `DebugElement` tree that wraps the _native_ elements for the runtime platform. The `nativeElement` property unwraps the `DebugElement` and returns the platform-specific element object.

`createComponent()` does not bind the data. Data binding happens when Angular performs **change detection**.

```ts
// before detectChange
it('no title in the DOM after createComponent()', () => {
  expect(h1.textContent).toEqual('');
});

// after detectChange
it('should display original title after detectChanges()', () => {
  fixture.detectChanges();
  expect(h1.textContent).toContain(component.title);
});

// also you can modify the component property before detectChange
it('should display a different test title', () => {
  component.title = 'Test Title';
  fixture.detectChanges();
  expect(h1.textContent).toContain('Test Title');
});
```

You can set [automatic change detection](https://angular.io/guide/testing#automatic-change-detection) by

```ts
import { ComponentFixtureAutoDetect } from '@angular/core/testing';

TestBed.configureTestingModule({
  declarations: [ BannerComponent ],
  providers: [
    { provide: ComponentFixtureAutoDetect, useValue: true }
  ]
});
```

Using automatic detect change with caution:

```ts
// this is why to be careful

it('should display original title', () => {
  // Hooray! No `fixture.detectChanges()` needed
  expect(h1.textContent).toContain(comp.title);
});

it('should still see original title after comp.title change', () => {
  const oldTitle = comp.title;
  comp.title = 'Test Title';
  // Displayed title is old because Angular didn't hear the change :(
  expect(h1.textContent).toContain(oldTitle);
});

it('should display updated title after detectChanges', () => {
  comp.title = 'Test Title';
  fixture.detectChanges(); // detect changes explicitly
  expect(h1.textContent).toContain(comp.title);
});
```

> The second and third test reveal an important limitation. The Angular testing environment does not know that the test changed the component's title. The ComponentFixtureAutoDetect service responds to asynchronous activities such as promise resolution, timers, and DOM events. But a direct, synchronous update of the component property is invisible. The test must call `fixture.detectChanges()` manually to trigger another cycle of change detection.

> And, even if the property is modified by the component methods, the test must call `fixture.detectChanges()` manually to trigger another cycle of change detection.

### Two way binding

In test, Angular doesn't know that you set the input element's value property. It won't read that property until you raise the element's input event by calling dispatchEvent(). Then you call detectChanges().

```ts
it('#input value emit to change <h1> text', () => {
  const input = (fixture.nativeElement as HTMLElement).querySelector('input');
  input.value = 'quick tea';
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  expect(h1.textContent).toBe('quick tea');
});
```

### Event trigger from element

```ts
//  from `nativeElement`
it('<button> should trigger #clicked', () => {
  expect(component.isOn).toBe(false);

  const button: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector('button');
  button.click();
  expect(component.isOn).toBe(true);
});

// from debugElement
it('<button> should trigger #clicked', () => {
  expect(component.isOn).toBe(false);

  const button: DebugElement = fixture.debugElement.query(By.css('button'));
  button.triggerEventHandler('click', null);
  expect(component.isOn).toBe(true);
});
```

We can have some `click()` helpers:

```ts
export const ButtonClickEvents = {
   left:  { button: 0 },
   right: { button: 2 }
};

/** Simulate element click. Defaults to mouse left-button click event. */
export function click(el: DebugElement | HTMLElement, eventObj: any = ButtonClickEvents.left): void {
  if (el instanceof HTMLElement) {
    el.click();
  } else {
    el.triggerEventHandler('click', eventObj);
  }
}
```

And use them like this:

```ts
it('should raise selected event when clicked (click helper)', () => {
  let selectedHero: Hero;
  comp.selected.subscribe(hero => selectedHero = hero);

  click(heroDe); // click helper with DebugElement
  click(heroEl); // click helper with native element

  expect(selectedHero).toBe(expectedHero);
});
```

### Test doubles

A component-under-test doesn't have to be injected with real services. In fact, it is usually better if they are test doubles (stubs, fakes, spies, or mocks). The purpose of the spec is to test the component, not the service, and real services can be trouble.

<details>

<summary>Create a `TestComponent` for testing `HighlightDirective`.</summary>

```ts
import { HighlightDirective } from './highlight.directive';
import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

@Component({
  template: `
  <h2 highlight="yellow">Something yellow</h2>
  <h2 highlight>The default color</h2>
  <h2> no highlight</h2>
  <input #box [highlight]="box.value" value="cyan" />`
})
class TestComponent {}

describe('HighlightDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let des: DebugElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HighlightDirective, TestComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    des = fixture.debugElement.queryAll(By.directive(HighlightDirective));
  });
  it('should have three hightlighted elements', () => {
    expect(des.length).toBe(3);
  });
  it('bare <h2> should not have a customProperty', () => {
    const bare = fixture.debugElement.query(By.css('h2:not([highlight])'));
    expect(bare.properties['customProperty']).toBeUndefined();
  })

  it('should color 1st <h2> background "yellow"', () => {
    expect(des[0].nativeElement.style.backgroundColor).toBe('yellow');
  });

  it('should color 2nd <h2> background with default color', () => {
    const dir:HighlightDirective = des[1].injector.get(HighlightDirective);
    const h2_2: HTMLElement = des[1].nativeElement;
    expect(h2_2.style.backgroundColor).toBe(dir.defaultColor);
  });

  it('should bind <input> background to value color', () => {
    const input: HTMLInputElement = des[2].nativeElement;
    expect(input.style.backgroundColor).toBe('cyan');
    input.value = 'green';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(input.style.backgroundColor).toBe('green');
  });

});
```

A few techniques are noteworthy:

- The `By.directive` predicate is a great way to get the elements that have this directive *when their element types are unknown*.

- The `:not` pseudo-class in `By.css('h2:not([highlight])')` helps find `<h2>` elements that do not have the directive. `By.css('*:not([highlight])')` finds any element that does not have the directive.

- `DebugElement.style` affords access to element styles even in the absence of a real browser, thanks to the `DebugElement` abstraction. But feel free to exploit the `nativeElement` when that seems easier or more clear than the abstraction.

- Angular adds a directive to the injector of the element to which it is applied. The test for the default color uses the injector of the second `<h2>` to get its `HighlightDirective` instance and its `defaultColor`.

- `DebugElement.properties` affords access to the artificial custom property that is set by the directive.

</details>

<details>
<summary>Create a `MockUserService` for injecting.</summary>

```ts
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WelcomeComponent } from './welcome.component';
import { UserService, IUser } from '../user.service';

class MockUserService {
  isLoggedIn = true;
  user: IUser = { name: 'Test User' };
}

describe('WelcomeComponent', () => {
  let component: WelcomeComponent;
  let fixture: ComponentFixture<WelcomeComponent>;
  let userService: UserService;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [WelcomeComponent],
      providers: [
        { provide: UserService, useClass: MockUserService },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    userService = TestBed.get(UserService);
  });

  it('should welcome logged in user after Angular calls ngOnInit', () => {
    expect(component.welcome).toContain(userService.user.name);
  });

  it('should ask user to log in if not logged in after ngOnInit', () => {
    userService.isLoggedIn = false;
    fixture = TestBed.createComponent(WelcomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.welcome).not.toContain(userService.user.name);
    expect(component.welcome).toContain('log in');
  });
});
```
</details>

<details>
<summary> `fakeAsync` for test async code </summary>

The `fakeAsync()` function enables a linear coding style by running the test body in a special `fakeAsync` test zone. The test body appears to be synchronous. There is no nested syntax (like a `Promise.then()`) to disrupt the flow of control. And you have to call `tick()` to advance the (virtual) clock, which simulates the passage of time until all pending asynchronous activities finish.

By default `fakeAsync()` supports the following `marcoTasks`.

- setTimeout

- setInterval

- requestAnimationFrame

- webkitRequestAnimationFrame

- mozRequestAnimationFrame

If you run other `macroTask` such as `HTMLCanvasElement.toBlob()`, Unknown `macroTask` scheduled in `fakeAsync` test error will be thrown.

You need to define the `marcoTask` you want to support in `beforeEach()`.

```ts
beforeEach(() => {
  window['__zone_symbol__FakeAsyncTestMacroTask'] = [
    {
      source: 'HTMLCanvasElement.toBlob',
      callbackArgs: [{ size: 200 }]
    }
  ];
});

it('toBlob should be able to run in fakeAsync', fakeAsync(() => {
    const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    let blob = null;
    canvas.toBlob(function(b) {
      blob = b;
    });
    tick();
    expect(blob.size).toBe(200);
  })
);
```

The `fakeAsync()` utility function has a few limitations. In particular, it won't work if the test body makes an XHR call.

XHR calls within a test are rare so you can generally stick with `fakeAsync()`. But if you ever do need to call XHR, you'll want to know about `async()`.

The `async()` utility hides some asynchronous boilerplate by arranging for the tester's code to run in a special `async` test zone. You don't need to pass Jasmine's `done()` into the test and call `done()` because it is `undefined` in promise or observable callbacks.

But the test's asynchronous nature is revealed by the call to `fixture.whenStable()`, which breaks the linear flow of control.

The test must wait for the `getQuote()` observable to emit the next quote. Instead of calling `tick()`, it calls `fixture.whenStable()`, [whenStable](https://angular.io/guide/testing#whenstable).

The `fixture.whenStable()` returns a promise that resolves when the JavaScript engine's task queue becomes empty. In

And when using an intervalTimer() such as setInterval() in async(), remember to cancel the timer with clearInterval() after the test, otherwise the async() never ends.

```ts
it('should show quote after getQuote (fakeAsync)', fakeAsync(() => {
  getQuoteSpy.and.returnValue(asyncData(testQuote));
  fixture.detectChanges();

  expect(quoteEl.textContent).toBe('...', 'should show placeholder "..."');

  flush();

  fixture.detectChanges();
  expect(quoteEl.textContent).toBe(testQuote, 'should show quote');
  expect(errorMessage()).toBeNull('should not show error');
}));

it('should show quote after getQuote (async)', async(() => {
  getQuoteSpy.and.returnValue(asyncData(testQuote));
  fixture.detectChanges();
  expect(quoteEl.textContent).toBe('...', 'should show placeholder "..."');
  fixture.whenStable().then(() => {
    fixture.detectChanges();
    expect(quoteEl.textContent).toBe(testQuote);
    expect(errorMessage()).toBeNull('should not show error');
  })
}));
```

In case you need to call `Jasmine.done()`. [Here](https://angular.io/guide/testing#jasmine-done) is the example:

```ts
it('should show last quote (quote done)', (done: DoneFn) => {
  fixture.detectChanges();

  component.quote.pipe( last() ).subscribe(() => {
    fixture.detectChanges(); // update view with quote
    expect(quoteEl.textContent).toBe(testQuote);
    done();
  });
});
it('should show quote after getQuote (spy done)', (done: DoneFn) => {
  fixture.detectChanges();

  // the spy's most recent call returns the observable with the test quote
  getQuoteSpy.calls.mostRecent().returnValue.subscribe(() => {
    fixture.detectChanges(); // update view with quote
    expect(quoteEl.textContent).toBe(testQuote);
    expect(errorMessage()).toBeNull('should not show error');
    done();
  });
});
```

More talks on Async code test could be found [here](https://angular.io/guide/testing#component-with-async-service).

```ts
import { async, ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';

import { TwainComponent } from './twain.component';
import { TwainService } from './twain.service';
import { of, throwError } from 'rxjs';

describe('TwainComponent', () => {
  let component: TwainComponent;
  let fixture: ComponentFixture<TwainComponent>;
  let getQuoteSpy: jasmine.Spy;
  let quoteEl: HTMLElement;
  const testQuote = 'test quote test';

  beforeEach(async(() => {
    const twainService = jasmine.createSpyObj('TwainService', ['getQuote']);
    getQuoteSpy = twainService.getQuote.and.returnValue(of(testQuote));
    TestBed.configureTestingModule({
      declarations: [TwainComponent],
      providers: [
        { provide: TwainService, useValue: twainService },
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TwainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    quoteEl = (fixture.nativeElement as HTMLElement).querySelector('.twain');
  });

  it('should show quote after component initalized', () => {
    expect(quoteEl.textContent).toBe(testQuote);
    expect(getQuoteSpy.calls.any()).toBe(true);
  });

  it('should display error when TwainService fails', fakeAsync(() => {
    getQuoteSpy.and.returnValue(
      throwError('TwainService test failure')
    );
    fixture.detectChanges();

    flush(); // ** flush the component's setTimeout() **
    // or
    // tick(100);

    fixture.detectChanges();

    expect(component.errorMessage).toMatch(/test failure/i, 'should display error');
    expect(quoteEl.textContent).toBe('...');
  }));

  it('should get Date diff correctly in fakeAsync', fakeAsync(() => {
    const start = Date.now();
    tick(100);
    const end = Date.now();
    expect(end - start).toBe(100);
  }));

  it('should get Date diff correctly in fakeAsync with rxjs scheduler', fakeAsync(() => {
    let result = null;
    of('hello').pipe(
      delay(100)
    ).subscribe(v => result = v);

    expect(result).toBeNull();
    tick(100);
    expect(result).toBe('hello');

    const start = Date.now();
    let diff = 0;
    interval(1000).pipe(take(2)).subscribe(() => diff = (Date.now() - start));
    expect(diff).toBe(0);
    tick(1000);
    expect(diff).toBe(1000);
    tick(1000);
    expect(diff).toBe(2000);
  }));

});
```
</details>

### Routing Test

It's quite a complicate test in routing components, read the [document](https://angular.io/guide/testing#routed-components) if needed.

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

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
