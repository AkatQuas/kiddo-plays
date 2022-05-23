import { render } from '@testing-library/react';
import { Title } from 'components/title';
import React from 'react';

describe('Title Component', () => {
  it('render large text', () => {
    const { baseElement } = render(<Title type="large" title="Large Text" />);
    expect(baseElement).toMatchSnapshot();
  });
  it('render small text', () => {
    const { baseElement } = render(<Title type="small" title="Small Text" />);
    expect(baseElement).toMatchSnapshot();
  });
});
