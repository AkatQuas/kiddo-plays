import { async, ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';

import { TwainComponent } from './twain.component';
import { TwainService } from './twain.service';
import { of, throwError } from 'rxjs';
import { asyncData } from 'src/testing/async-observable';

describe('TwainComponent', () => {
  let component: TwainComponent;
  let fixture: ComponentFixture<TwainComponent>;
  let getQuoteSpy: jasmine.Spy;
  let quoteEl: HTMLElement;
  const testQuote = 'test quote test';

   // Helper function to get the error message element value
  // An *ngIf keeps it out of the DOM until there is an error
  const errorMessage = () => {
    const el = fixture.nativeElement.querySelector('.error');
    return el ? el.textContent : null;
  };

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
    quoteEl = (fixture.nativeElement as HTMLElement).querySelector('.twain');
  });

  it('should show quote after component initalized', () => {
    fixture.detectChanges();
    expect(quoteEl.textContent).toBe(testQuote);
    expect(getQuoteSpy.calls.any()).toBe(true);
  });

  it('should display error when TwainService fails', fakeAsync(() => {
    getQuoteSpy.and.returnValue(
      throwError('TwainService test failure')
    );
    fixture.detectChanges();

    // flush(); // flush the component's setTimeout()
    tick(100);

    fixture.detectChanges();

    expect(component.errorMessage).toMatch(/test failure/i, 'should display error');
    expect(quoteEl.textContent).toBe('...');
  }));

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
});
