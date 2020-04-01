import { shallowMount } from '@vue/test-utils';
import Hello from '@/components/Hello.vue';

describe('Hello.vue', () => {
  it('works fine', () => {
    const wrapper = shallowMount(Hello);
    wrapper.setData({
      username: ' '.repeat(7),
    });

    expect(wrapper.find('.error').exists()).toBe(true);

    wrapper.setData({
      username: 'Lachlan'
    });

    expect(wrapper.find('.error').exists()).toBe(false);
  })
});
