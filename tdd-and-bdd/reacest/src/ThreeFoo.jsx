import React, { Component, Fragment } from 'react';
import FooOne from './FooOne';

class ThreeFoo extends Component {
  state = {
    site: 'qq'
  };
  onChange = (e) => {
    this.setState({
      site: e.target.value,
    });
  }
  btn = () => {
    const {  onButtonClick } = this.props;
    onButtonClick('angular');
  }
  render() {
    const { site } = this.state;
    const { children } = this.props;
    return (
      <Fragment>
        <div className="icon-star"></div>
        <FooOne />
        <FooOne />
        <button onClick={this.btn}></button>
        <FooOne />
        <span className="site">{site}</span>
        <input value={site} onChange={this.onChange} />
        {children}
      </Fragment>
    );
  }
}

export default ThreeFoo;
