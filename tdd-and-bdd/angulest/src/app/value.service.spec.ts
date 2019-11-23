import { TestBed } from '@angular/core/testing';

import { ValueService } from './value.service';

describe('ValueService', () => {
  let service: ValueService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.get(ValueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('#getValue should return real value', () => {
    expect(service.getValue()).toBe('real value');
  });

  it('#getObservable should return value from observable', (done: DoneFn) => {
    service.getObservableValue().subscribe(val => {
      expect(val).toBe('observable value');
      done();
    });
  });

  it('#getPromiseValue should return value from a promie', (done: DoneFn) => {
    service.getPromiseValue().then(val => {
      expect(val).toBe('promise value');
      done();
    });
  });

});
