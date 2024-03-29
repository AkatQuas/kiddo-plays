import { IBook } from '@acme/shared-modules';
import { Button } from '@acme/ui';
import { useCallback } from 'react';
import styled from 'styled-components';

export type BookProps = {
  book: IBook;
  onAdd: (book: IBook) => void;
};

const StyledBook = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid #ccc;
  &:last-child {
    border-bottom: none;
  }
  > span {
    padding: 1rem 0.5rem;
    margin-right: 0.5rem;
  }
  .title {
    flex: 1;
  }
  .rating {
    color: #999;
  }
  .price {
    color: #478d3c;
  }
`;

export function Book({ book, onAdd }: BookProps) {
  const handleAdd = useCallback(() => {
    onAdd(book);
  }, [book, onAdd]);
  return (
    <StyledBook>
      <span className="title">
        {book.title} by <em>{book.author}</em>
      </span>

      <span className="rating">{book.rating}</span>
      <span className="price">${book.price}</span>
      <span>
        <Button onClick={handleAdd}>Add to Cart</Button>
      </span>
    </StyledBook>
  );
}

export default Book;
