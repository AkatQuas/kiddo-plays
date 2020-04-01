import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class CheckboxWithLabel extends Component {
  static propTypes = {
    labelOn: PropTypes.string.isRequired,
    labelOff: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      isChecked: false,
    };
  };

  onChange = () => {
    const { isChecked } = this.state;
    this.setState({ isChecked: !isChecked });
  }

  render () {
    const { isChecked } = this.state;
    const { labelOn, labelOff } = this.props;
    return (
      <label>
        <input type="checkbox" checked={isChecked} onChange={this.onChange} />
        { isChecked ? labelOn :  labelOff }
      </label>
    )
  }

}

