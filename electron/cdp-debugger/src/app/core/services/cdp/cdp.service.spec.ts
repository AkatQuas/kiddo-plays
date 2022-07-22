import { TestBed } from '@angular/core/testing';

import { CDPService } from './cdp.service';

describe('CDPService', () => {
  let service: CDPService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CDPService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
