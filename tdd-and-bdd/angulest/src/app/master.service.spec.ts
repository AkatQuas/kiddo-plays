import { TestBed } from '@angular/core/testing';

import { MasterService } from './master.service';
import { ValueService } from './value.service';
import { FakeValueService } from './fake-value.service';

describe('MasterService', () => {
  let service: MasterService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.get(MasterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('#getValue should return value from the real service', () => {
    expect(service.getValue()).toEqual('real value');
  });

  it('#getValue should return faked value from a fakeService', () => {
    const masterService = new MasterService(new FakeValueService());
    expect(masterService.getValue()).toBe('faked service value');
  });

  it('#getValue should return faked value from a fake object', () => {
    const fakeValue = 'fake value';
    const fake = { getValue: () => fakeValue };
    const masterService = new MasterService(fake as ValueService);
    expect(masterService.getValue()).toBe(fakeValue);
  });

  it('#getValue should return stubbed value from a spy', () => {
    const valueServiceSpy = jasmine.createSpyObj('ValueService', ['getValue']);
    const stubValue = 'stub value';
    valueServiceSpy.getValue.and.returnValue(stubValue);

    const masterService = new MasterService(valueServiceSpy);
    expect(masterService.getValue()).toEqual(stubValue, 'service returned stub value');

    expect(valueServiceSpy.getValue.calls.count()).toBe(1);
    expect(valueServiceSpy.getValue.calls.mostRecent().returnValue).toBe(stubValue);
  });
});
