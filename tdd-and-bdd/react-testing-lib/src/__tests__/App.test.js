import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  test('renders learn react link', () => {
    render(<App />);
    const linkElement = screen.getByText(/learn react/i);
    expect(linkElement).toBeInTheDocument();
    // screen.debug();
    //     ^ HTML output of the Component
  });

  test('Render search components', async () => {
    render(<App />);
    // implicit assertion
    // because getByText would throw error
    // if element wouldn't be there
    screen.getByText('Search:');

    // explicit assertion
    // recommended
    expect(screen.getByText('Search:')).toBeInTheDocument();

    // this will succeeds
    expect(
      screen.getByText((content, element) => content.indexOf('Search') > -1)
    ).toBeInTheDocument();

    // this will succeeds
    expect(screen.queryByText('Search')).toBeNull();

    // succeeds
    expect(screen.getByText(/Search/)).toBeInTheDocument();
    expect(screen.queryByText(/not Search/)).not.toBeInTheDocument();
  });

  test('Render User components eventually', async () => {
    render(<App />);
    expect(screen.queryByText(/Signed in as/)).toBeNull();
    // screen.debug();

    expect(await screen.findByText(/Signed in as/)).toBeInTheDocument();
    // screen.debug();
  });

  test('Render User components eventually', async () => {
    render(<App />);
    expect(screen.queryByText(/Signed in as/)).toBeNull();

    await waitFor(() => {
      expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
    });
  });
});
