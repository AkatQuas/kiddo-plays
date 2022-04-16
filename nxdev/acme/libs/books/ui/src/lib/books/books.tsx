import { IBook } from '@acme/shared-modules';
import styled from 'styled-components';
import { Book } from '../book/book';

export type BooksProps = {
  books: IBook[];
  onAdd: (book: IBook) => void;
};

const StyledBooks = styled.div`
  border: 1px solid #ccc;
  border-radius: 4px;
`;

export function Books({ books, onAdd }: BooksProps) {
  return (
    <StyledBooks>
      {books.map((book) => (
        <Book key={book.id} book={book} onAdd={onAdd}></Book>
      ))}
    </StyledBooks>
  );
}

export default Books;
