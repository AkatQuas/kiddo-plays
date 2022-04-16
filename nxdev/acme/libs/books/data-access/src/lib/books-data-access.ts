import { IBook } from '@acme/shared-modules';

export async function getBooks(): Promise<IBook[]> {
  return await fetch('/api/books', {
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((data) => data.json());
}
