# Reacest

This project focus on how to write test cases in React with [Jest](https://jestjs.io).

Here is how we [get started](https://jestjs.io/docs/en/tutorial-react), all the test files are under directory [`src/__test__`](src/__test__/).

The `@testing-library/react' is kind of clumsy.

However, it's more effective to write unit test in React with [enzyme](https://airbnb.io/enzyme/) and [Jest](https://jestjs.io).

[Great API reference](https://airbnb.io/enzyme/docs/api/) in enzyme.

## State

```js
it('has "site" in state', () => {
  expect(wrapper.state('site')).toBe('qq');
})
```

## Input value change

```js
it('simutlates input event', () => {
  wrapper.find('input').simulate('change', {
    target: {
      value: 'tt',
    }
  });
  expect(wrapper.find('span.site').text()).toContain('tt');
});

it('simutlates input event', () => {
  // shallow won't work for the `instance` method
  const wrapper = mount(<ThreeFoo />)
  const input = wrapper.find('input');
  input.instance().value = 'tt';
  input.simulate('change');
  expect(wrapper.find('span.site').text()).toContain('tt');
});
```

[Enzyme Selectors](https://airbnb.io/enzyme/docs/api/selector.html), supports:

1. A Valid CSS Selector

```
div.foo.bar
input#input-name
a[href="foo"]
.foo .bar
.foo > .bar
.foo + .bar
.foo ~ .bar
.foo input
```

1. A React Component Constructor

```js
function MyComponent() {
  return <div />;
}

// find instances of MyComponent
const myComponents = wrapper.find(MyComponent);
```

1. A React Component's Display name

```js
function MyComponent() {
  return <div />;
}
MyComponent.displayName = 'My Component';

// find instances of MyComponent
const myComponents = wrapper.find('My Component');
```

1. Object Property Selector

```js
const wrapper = mount((
  <div>
    <span foo={3} bar={false} title="baz" />
  </div>
));

wrapper.find({ foo: 3 });
wrapper.find({ bar: false });
wrapper.find({ title: 'baz' });
```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br>
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: https://facebook.github.io/create-react-app/docs/code-splitting

### Analyzing the Bundle Size

This section has moved here: https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size

### Making a Progressive Web App

This section has moved here: https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app

### Advanced Configuration

This section has moved here: https://facebook.github.io/create-react-app/docs/advanced-configuration

### Deployment

This section has moved here: https://facebook.github.io/create-react-app/docs/deployment

### `npm run build` fails to minify

This section has moved here: https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify
