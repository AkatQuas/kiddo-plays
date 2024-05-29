import { Injectable } from '@angular/core';
import { HousingLocation } from './housing-location';

@Injectable({
  providedIn: 'root',
})
export class HousingService {
  readonly url = 'http://localhost:9090/locations';

  async getAll(): Promise<HousingLocation[]> {
    const data = await fetch(this.url);
    return (await data.json()) ?? [];
  }

  async getById(id: number): Promise<HousingLocation | undefined> {
    const data = await fetch(`${this.url}/${id}`);
    return (await data.json()) ?? {};
  }

  submit(payload: { first_name: string; last_name: string; email: string }) {
    console.debug(
      '\x1B[97;42;1m --- Submit application --- \x1B[m',
      '\n',
      payload
    );
  }
}
