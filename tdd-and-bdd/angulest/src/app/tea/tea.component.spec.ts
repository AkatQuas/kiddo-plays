import { async, ComponentFixture, TestBed, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { TeaComponent } from './tea.component';

describe('TeaComponent', () => {
  let component: TeaComponent;
  let fixture: ComponentFixture<TeaComponent>;
  let h1: HTMLElement;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TeaComponent],
      imports: [
        FormsModule,
      ],
      providers: [
        { provide: ComponentFixtureAutoDetect, useValue: true }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TeaComponent);
    component = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    h1 = el.querySelector('h1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display orginal title', () => {
    expect(h1.textContent).toContain(component.tea);
  });

  it('should still see original title after component.title change', () => {
    const old = component.tea;
    component.tea = 'New test tea';
    expect(h1.textContent).toContain(old);
  });

  it('should display updated title after detectChanges', () => {
    const tea = 'New teatea';
    component.tea = tea;
    fixture.detectChanges();
    expect(h1.textContent).toContain(tea);
  });

  it('should dislay update title fater #setTea called', () => {
    const tea = component.setTea();
    fixture.detectChanges();
    expect(h1.textContent).toContain(tea);
  });

  it('#input value emit to change <h1> text', () => {
    const input = (fixture.nativeElement as HTMLElement).querySelector('input');
    const n = 'quick tea';
    input.value = n;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(h1.textContent).toBe(n);
  });
});
