import { shallowMount } from '@vue/test-utils';
import Async from '@/components/Async.vue';

describe('Async.vue', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallowMount(Async);
  });

  it('should set the correct user value after ajax', done => {
    expect(wrapper.vm.user).toBeNull();

    wrapper.find('button.user').trigger('click');

    wrapper.vm.$nextTick(() => {
      expect(wrapper.vm.user).toBe('xx');
      done();
    });
  })
})