import { TestBed } from '@angular/core/testing';

import { UserService } from './user.service';

describe('UserService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: UserService = TestBed.get(UserService);
    expect(service).toBeTruthy();
  });

  it('should start with not logged in', () => {
    const service: UserService = TestBed.get(UserService);
    expect(service.isLoggedIn).toBe(false);
  });

  it('should loggedIn when #login() called(), logged out when #logout() called', () => {
    const service: UserService = TestBed.get(UserService);
    expect(service.isLoggedIn).toBe(false);
    service.login();
    expect(service.isLoggedIn).toBe(true);
    service.logout();
    expect(service.isLoggedIn).toBe(false);
  });

  // todo
  it('should have a user with interface "IUser"', () => {
    const service: UserService = TestBed.get(UserService);
    expect(service.user.name).toBeDefined();
  })
});
