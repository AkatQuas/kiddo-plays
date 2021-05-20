import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterChangeComponent } from './counter-change.component';

describe('CounterChangeComponent', () => {
  let component: CounterChangeComponent;
  let fixture: ComponentFixture<CounterChangeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CounterChangeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CounterChangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
