# vuest

Vue project with Jest!

Focusing on how to write unit test cases within Vue!

[The vue-test-utils](https://vue-test-utils.vuejs.org/)

[The MOST useful handbook: vue-test-utils](https://lmiller1990.github.io/vue-testing-handbook/#what-is-this-guide)

## Knowing what to test

For UI components, we don't recommend aiming for complete line-based coverage, because it leads to too much focus on the internal implementation details of the components and could result in brittle tests.

Instead, we recommend writing tests that assert your component's public interface, and treat its internals as a black box. A single test case would assert that some input (user interaction or change of props) provided to the component results in the expected output (render result or emitted custom events).

The benefit of this approach is that as long as your component's public interface remains the same, your tests will pass no matter how the component's internal implementation changes over time.

## Shallow Rendering

In unit tests, we typically want to focus on the component being tested as an isolated unit and avoid indirectly asserting the behavior of its child components.

In addition, for components that contain many child components, the entire rendered tree can get really big. Repeatedly rendering all child components could slow down our tests.

Vue Test Utils allows you to mount a component without rendering its child components (by stubbing them) with the `shallowMount` method.

```js
import { shallowMount } from '@vue/test-utils'

const wrapper = shallowMount(Component)
wrapper.vm // the mounted Vue instance
```

## Two way binding

`setValue` is kind of syntax sugar for

```js
textInput.element.value = value;
textInput.trigger('input');

//or
select.element.value = value;
select.trigger('change');
```

```js
import { mount } from '@vue/test-utils'
import Foo from './Foo.vue'

const wrapper = mount(Foo)

const textInput = wrapper.find('input[type="text"]')
textInput.setValue('some value')

const select = wrapper.find('select')
select.setValue('option value')
```

## Asserting Emitted Events

Each mounted wrapper automatically records all events emitted by the underlying Vue instance. You can retrieve the recorded events using the `wrapper.emitted()` method:

```js
wrapper.vm.$emit('foo')
wrapper.vm.$emit('foo', 123)

/*
`wrapper.emitted()` returns the following object:
{
  foo: [[], [123]]
}
*/

// assert event has been emitted
expect(wrapper.emitted().foo).toBeTruthy()

// assert event count
expect(wrapper.emitted().foo.length).toBe(2)

// assert event payload
expect(wrapper.emitted().foo[1]).toEqual([123])
```

## Child Component Emitting Event

```js
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
```

## Using with Vuex

[Quite a long document](https://vue-test-utils.vuejs.org/guides/#using-with-vuex).

## Deep with Wrapper

A `wrapper` is an object that contains a mounted component or vnode and methods to test the component or vnode, [link](https://vue-test-utils.vuejs.org/api/wrapper/#wrapper).

## Mounting Options

Sometime we want to wrap the component with some starting options, the `mount` and `shallowMount` function can have a second parameter known as **Mounting Options**, [link](https://vue-test-utils.vuejs.org/api/options.html#context).

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn run serve
```

### Compiles and minifies for production
```
yarn run build
```

### Run your tests
```
yarn run test
```

### Lints and fixes files
```
yarn run lint
```

### Run your end-to-end tests
```
yarn run test:e2e
```

### Run your unit tests
```
yarn run test:unit
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
