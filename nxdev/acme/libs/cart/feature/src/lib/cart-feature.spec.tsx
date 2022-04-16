import { render } from '@testing-library/react';

import CartFeature from './cart-feature';

describe('CartFeature', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<CartFeature />);
    expect(baseElement).toBeTruthy();
  });
});
