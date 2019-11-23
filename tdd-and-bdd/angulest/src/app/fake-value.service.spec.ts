import { TestBed } from '@angular/core/testing';

import { FakeValueService } from './fake-value.service';

describe('FakeValueService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FakeValueService = TestBed.get(FakeValueService);
    expect(service).toBeTruthy();
  });
});
