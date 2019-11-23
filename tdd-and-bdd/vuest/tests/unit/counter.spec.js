import { shallowMount } from '@vue/test-utils';
import Counter from '@/components/Counter.vue';

describe('Counter.vue', () => {
  let wrapper;
  const factory = (data) => shallowMount(Counter, {
    data: () => data,
  });
  beforeEach(() => {
    wrapper = shallowMount(Counter);
  });
  ;[1, 2, 3].forEach(count => {
    it('should start with ' + count, () => {
      const wrapper = factory({ count });
      expect(wrapper.vm.count).toBe(count);
      expect(wrapper.find('.count').text()).toBe('' + count);
    });
  })
  it('should render with a button tag', () => {
    expect(wrapper.contains('button')).toBe(true);
  });

  it('button trigger to count increment', () => {
    expect(wrapper.vm.count).toBe(0);
    const button = wrapper.find('button');
    button.trigger('click');
    expect(wrapper.vm.count).toBe(1);
  });

  it('should emit successfully', () => {
    wrapper.vm.$emit('foo');
    wrapper.vm.$emit('foo', 123);

    expect(wrapper.emitted().foo).toBeDefined();

    expect(wrapper.emitted().foo.length).toBe(2);

    expect(wrapper.emitted().foo[1]).toEqual([123]);
  });
})