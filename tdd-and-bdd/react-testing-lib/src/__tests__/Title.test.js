import { render, screen } from '@testing-library/react';
import Title from '../components/Title';

test('Render Title with title', () => {
  render(<Title title="24" />);
  // screen.debug();
  expect(screen.getByText('24')).toBeInTheDocument();
});
