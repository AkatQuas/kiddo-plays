import { shallowMount } from '@vue/test-utils';
import Quantity from '@/components/Quantity';

describe('Key events tests', () => {
  let wrapper;
  const x = 5;

  beforeEach(() => {
    wrapper = shallowMount(Quantity);
  });

  it('Quantity is zero by default', () => {
    expect(wrapper.vm.quantity).toBe(0);
  });

  it('Up arrow key increase quantity by 1', () => {
    wrapper.trigger('keydown.up');
    expect(wrapper.vm.quantity).toBe(1);
  });

  it('Down arrow key decrease quantity by 1', () => {
    wrapper.setData({
      quantity: x,
    });
    wrapper.trigger('keydown.down');
    expect(wrapper.vm.quantity).toBe(x - 1);
  });

  it('Escape sets quantity to 0', () => {
    wrapper.setData({
      quantity: x,
    });
    expect(wrapper.vm.quantity).toBe(x);
    wrapper.trigger('keydown.esc');
    expect(wrapper.vm.quantity).toBe(0);
  });

  it('Magic character "a" sets quantity to 13', () => {
    wrapper.trigger('keydown', {
      key: 'a',
    });
    expect(wrapper.vm.quantity).toBe(13);
  })
});