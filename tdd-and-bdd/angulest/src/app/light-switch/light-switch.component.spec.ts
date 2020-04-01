import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LightSwitchComponent } from './light-switch.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('LightSwitchComponent', () => {
  let component: LightSwitchComponent;
  let fixture: ComponentFixture<LightSwitchComponent>;

  beforeEach(() => {
    console.log('before 0');
  });

  beforeEach(async(() => {
    console.log('before 1');

    TestBed.configureTestingModule({
      declarations: [LightSwitchComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    console.log('before 2');
    fixture = TestBed.createComponent(LightSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('#clicked() should toggle #isOn', () => {
    expect(component.isOn).toBe(false, 'off at first');
    component.clicked();
    expect(component.isOn).toBe(true, 'on after click');
    component.clicked();
    expect(component.isOn).toBe(false, 'off after second click');
  });

  it('#clicked() should set #message to "is on"', () => {
    expect(component.message).toMatch(/is off/i, 'off at first');
    component.clicked();
    expect(component.message).toMatch(/is on/i, 'on after clicked');
    component.clicked();
    expect(component.message).toMatch(/is off/i, 'off atfer second click');
  });

  it('<button> should trigger #clicked', () => {
    expect(component.isOn).toBe(false);

    const button: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector('button');
    button.click();
    expect(component.isOn).toBe(true);
  });
  it('<button> should trigger #clicked', () => {
    expect(component.isOn).toBe(false);

    const button: DebugElement = fixture.debugElement.query(By.css('button'));
    button.triggerEventHandler('click', null);
    expect(component.isOn).toBe(true);
  });

});
