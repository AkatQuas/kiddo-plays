import { shallowMount } from '@vue/test-utils';
import YesNoComponent from '@/components/YesNo.vue';

describe('Click event', () => {
  ;['yes', 'no'].forEach(text => {
    it(`click on ${text} button calls our method with argument " ${text}"`, () => {
      const spy = jest.fn();
      const wrapper = shallowMount(YesNoComponent, {
        propsData: {
          callMe: spy
        },
      });
      wrapper.find('button.' + text).trigger('click');

      expect(spy).toBeCalledWith(text);
    });
  });
});
