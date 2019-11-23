import React from 'react';
import Link from '../Link';
import renderer from 'react-test-renderer';

describe('Link Component', () => {
  let component;
  beforeEach(() => {
    component = renderer.create(
      <Link page="http://www.facebook.com">Facebook</Link>
    );
  });
  it('Link changes the class when hovered', () => {
    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();

    // manually trigger the callback
    tree.props.onMouseEnter();
    // re-rendering
    tree = component.toJSON();
    expect(tree).toMatchSnapshot();

    // manually trigger the callback
    tree.props.onMouseLeave();
    tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
