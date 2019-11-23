import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerComponent } from './banner.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('BannerComponent', () => {
  let component: BannerComponent;
  let fixture: ComponentFixture<BannerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BannerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should find the <p> with fixture.debugElement.nativeElement', () => {
    const bannerEl: HTMLElement = fixture.nativeElement;
    const p = bannerEl.querySelector('p');
    expect(p.textContent).toContain('banner works!');
  });

  it('should find the <p> with fixture.debugElement.query(By.css())', () => {
    const bannerDe: DebugElement = fixture.debugElement;
    const pDe = bannerDe.query(By.css('p'));
    const p:HTMLElement = pDe.nativeElement;
    expect(p.textContent).toContain('banner works!');
  });

  it('should display original title in <h1>', () => {
    const bannerEl: HTMLElement = fixture.nativeElement;
    const h1El: HTMLElement = bannerEl.querySelector('h1');
    expect(h1El.textContent).toContain(component.title);
  });
  it('should have no content before detectChange, and should contain title after detectChange', () => {
    fixture = TestBed.createComponent(BannerComponent);
    component = fixture.componentInstance;
    const bannerEl: HTMLElement = fixture.nativeElement;
    const h1El: HTMLElement = bannerEl.querySelector('h1');
    expect(h1El.textContent).toEqual('');
    const testTitle = 'This is a test title';
    component.title = testTitle;
    fixture.detectChanges();
    expect(h1El.textContent).toContain(testTitle);
  });
});
