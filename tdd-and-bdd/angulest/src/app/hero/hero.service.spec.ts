import { TestBed } from '@angular/core/testing';

import { HeroService, IHero } from './hero.service';
import { asyncData } from 'src/testing/async-observable';
import { HttpClient } from '@angular/common/http';

describe('HeroService', () => {
  let httpClientSpy: { get: jasmine.Spy };

  beforeEach(() => {
    httpClientSpy = jasmine.createSpyObj('HttpClient', ['get']);
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpClientSpy }
      ]
    });
  });

  it('should be created', () => {
    const service: HeroService = TestBed.get(HeroService);
    expect(service).toBeTruthy();
  });

  it('should return expected heroes (HttpClient called once)', () => {
    const expectedHeroes: IHero[] = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ];
    httpClientSpy.get.and.returnValue(asyncData(expectedHeroes));

    const service: HeroService = TestBed.get(HeroService);
    service.getHeroes().subscribe(
      heroes => expect(heroes).toEqual(expectedHeroes, 'expected heroes'),
      fail,
    );
    expect(httpClientSpy.get.calls.count()).toBe(1, 'called once');
  });


});
