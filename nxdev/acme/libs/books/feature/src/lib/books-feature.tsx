import { getBooks } from '@acme/books/data-access';
import { Books } from '@acme/books/ui';
import { cartActions } from '@acme/cart/data-access';
import { IBook } from '@acme/shared-modules';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

export const BooksFeature = () => {
  const [books, setBooks] = useState<IBook[]>([]);
  const dispatch = useDispatch();
  useEffect(
    () => {
      getBooks().then(setBooks);
    },
    [
      // This effect runs only once on first component render
      // so we declare it as having no dependent state.
    ]
  );
  const handleAdd = useCallback(
    (book: IBook) => {
      dispatch(
        cartActions.add({
          id: book.id,
          description: book.title,
          cost: book.price,
        })
      );
    },
    [dispatch]
  );
  return (
    <>
      <h2>Books</h2>
      <Books books={books} onAdd={handleAdd} />
    </>
  );
};

export default BooksFeature;
