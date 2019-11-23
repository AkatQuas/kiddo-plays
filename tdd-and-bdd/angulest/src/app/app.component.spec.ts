import { TestBed, async, fakeAsync, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { TeaComponent } from './tea/tea.component';
import { FormsModule } from '@angular/forms';
import { TwainComponent } from './twain/twain.component';
import { of, interval } from 'rxjs';
import { delay, take } from 'rxjs/operators';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent,
        TeaComponent,
        TwainComponent,
      ],
      imports: [
        FormsModule,
      ]
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'angulest'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app.title).toEqual('angulest');
  });

  it('should render title in a h3 tag', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector('h3').textContent).toContain('Welcome to angulest!');
  });

  it('should run timeout callback with delay after call tick with millis', fakeAsync(() => {
    let called = false;
    setTimeout(() => {
      called = true;
    }, 100);
    tick(50);
    expect(called).toBe(false);
    tick(50);
    expect(called).toBe(true);
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
