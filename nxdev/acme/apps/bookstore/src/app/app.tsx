import { BooksFeature } from '@acme/books/feature';
import { CartFeature } from '@acme/cart/feature';
import {
  GlobalStyles,
  Header,
  Main,
  NavigationItem,
  NavigationList
} from '@acme/ui';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

export function App() {
  return (
    <>
      <GlobalStyles></GlobalStyles>
      <Header>
        <h1>Bookstore</h1>
        <NavigationList>
          <NavigationItem>
            <Link to="/books">Books</Link>
          </NavigationItem>
          <NavigationItem>
            <Link to="/cart">Cart</Link>
          </NavigationItem>
        </NavigationList>
      </Header>

      <Main>
        <Routes>
          <Route path="/" element={<Navigate to="/books" />} />
          <Route path="/cart" element={<CartFeature />}></Route>
          <Route path="/books" element={<BooksFeature />} />
        </Routes>
      </Main>
    </>
  );
}

export default App;
