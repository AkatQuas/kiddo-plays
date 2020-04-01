import { shallowMount } from '@vue/test-utils';
import Fooa from '@/components/Fooa.vue';

describe('Fooa', () => {
  it('renderns a message and response correctly to user input', () => {
    const wrapper = shallowMount(Fooa, {
      data: () => ({
        message: 'Hello Fooa',
        username: '',
      })
    });

    expect(wrapper.find('.message').text()).toEqual('Hello Fooa');

    expect(wrapper.find('.error').exists()).toBeTruthy();
    expect(wrapper.find('.username').exists()).toBeFalsy();

    wrapper.setData({ username: 'Lachlan' });
    expect(wrapper.find('.error').exists()).toBeFalsy();
    expect(wrapper.find('.username').text()).toBe('Lachlan');
  })
});