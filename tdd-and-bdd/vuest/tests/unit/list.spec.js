import { shallowMount } from '@vue/test-utils';
import List from '@/components/List.vue';

describe('List.vue', () => {
  const factory = (props) => shallowMount(List, {
    propsData: props,
  });

  it('renders li for each item in props.item', () => {
    const items = ['1', '2'];
    const wrapper = factory({ items });
    expect(wrapper.findAll('li')).toHaveLength(items.length);
    expect(wrapper.findAll('li').length).toBe(items.length);
  });

  it('matches snapshot', () => {
    const items = ['item 1', 'item 2'];
    const wrapper = factory({ items });
    expect(wrapper.html()).toMatchSnapshot();

    expect(wrapper.find('.message').text()).toBe('default message');
  });

  it('render correct message', () => {
    const items = ['item 1', 'item 2'];
    const message = 'qaqaqa';
    const wrapper = factory({ items, message });

    expect(wrapper.find('.message').text()).toBe(message);
  });

  it('render correct message', () => {
    const items = ['item 1', 'item 2'];
    const wrapper = factory({ items  });

    expect(wrapper.find('.message').text()).toBe('default message');

    const message = '99999';
    wrapper.setProps({
      message,
    });
    expect(wrapper.find('.message').text()).toBe(message);

  });

})