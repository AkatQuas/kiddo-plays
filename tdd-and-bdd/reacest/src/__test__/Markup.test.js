import React from 'react';
import Markup from '../Markup';
import { render, configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

describe('<Markup />', () => {
  it('renders three `.foo-bar`s', () => {
    const wrapper = render(<Markup />);
    expect(wrapper.find('.foo-bar').length).toBe(3);
  });

  it('renders the title', () => {
    let wrapper = render(<Markup />);
    expect(wrapper.text()).not.toMatch(/unique/i);
    wrapper = render(<Markup title="unique" />);
    expect(wrapper.text()).toMatch(/unique/i);
  });

  it('can pass in context', () => {
    const context = { name: 'name-foo' };
    const wrapper = render(<Markup />, { context });
    expect(wrapper.find('.name').length).toBe(1);
    expect(wrapper.find('.name').text()).toEqual(context.name);
  })
})
