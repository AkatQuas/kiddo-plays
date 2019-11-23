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
