import { shallowMount } from '@vue/test-utils';
import Parent from '@/components/Parent';
import Child from '@/components/Child';

describe('Parent.vue', () => {
  it('displays "Emitted!" when child emit event', () => {
    const wrapper = shallowMount(Parent);
    wrapper.find(Child).vm.$emit('custom');
    expect(wrapper.html()).toContain('Emitted!');
  });
});

describe('Child.vue', () => {
  it('#input ', () => {
    const wrapper = shallowMount(Child);
    const input = wrapper.find('input');
    input.setValue('real');
    const span = wrapper.find('span');
    expect(span.text()).toBe('real');
  })
})