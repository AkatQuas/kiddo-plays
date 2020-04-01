import React, { Component } from 'react';

const STATUS = {
  HOVERED: 'hovered',
  NORMAL: 'normal',
};

export default class Link extends Component {
  constructor(props) {
    super(props);
    this.state = {
      cls: STATUS.NORMAL,
    };
  };

  onMouseEnter = () => {
    this.setState({ cls: STATUS.HOVERED });
  }

  onMouseLeave = () => {
    this.setState({ cls: STATUS.NORMAL });
  }

  render() {
    const { children, page } = this.props;
    const { cls } = this.state;
    return (
      <a
        className={cls}
        href={page || '#'}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        {children}
      </a>
    )
  }
}
