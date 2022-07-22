import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortFormComponent } from './port-form.component';

describe('PortFormComponent', () => {
  let component: PortFormComponent;
  let fixture: ComponentFixture<PortFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PortFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PortFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
