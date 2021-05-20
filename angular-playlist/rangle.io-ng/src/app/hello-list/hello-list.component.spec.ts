import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelloListComponent } from './hello-list.component';

describe('HelloListComponent', () => {
  let component: HelloListComponent;
  let fixture: ComponentFixture<HelloListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HelloListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HelloListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
