import React from 'react';
import { shallow, configure, mount } from 'enzyme';

import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

import FooOne from '../FooOne';
import ThreeFoo from '../ThreeFoo';

describe('<ThreeFoo />', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<ThreeFoo />);
  });
  it('has "site" in state', () => {
    expect(wrapper.state('site')).toBe('qq');
  })
  it('renders three <FooOne /> components', () => {
    expect(wrapper.find(FooOne).length).toBe(3);
  });
  it('renders an `.icon-star` div', () => {
    expect(wrapper.find('div.icon-star').length).toBe(1);
  });
  it('renders children when passed in', () => {
    const children = <div>123</div>;
    const wrapper = shallow((
      <ThreeFoo>
        {children}
      </ThreeFoo>
    ));
    expect(wrapper.contains(children)).toBeTruthy();
  });
  it('simutlates click events', () => {
    const f = jest.fn();
    const wrapper = shallow(<ThreeFoo onButtonClick={f} />);
    wrapper.find('button').simulate('click');
    expect(f).toBeCalledWith('angular');
  });

  it('simutlates input event', () => {
    wrapper.find('input').simulate('change', {
      target: {
        value: 'tt',
      }
    });
    expect(wrapper.find('span.site').text()).toContain('tt');
  });

  it('simutlates input event', () => {
    const wrapper = mount(<ThreeFoo />)
    const input = wrapper.find('input');
    input.instance().value = 'tt';
    input.simulate('change');
    expect(wrapper.find('span.site').text()).toContain('tt');
  });
});
