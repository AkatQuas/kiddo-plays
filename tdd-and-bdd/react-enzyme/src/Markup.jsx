import React from 'react';
import PropTypes from 'prop-types';

const Markup = ({ title }, { name }) => {
  return (
    <div>
      <div className="foo-bar"></div>
      <div className="foo-bar"></div>
      <div className="foo-bar"></div>
      {title ? <p>{title}</p> : null}
      {name ? <div className="name">{name}</div> : null}
    </div>
  );
};
Markup.contextTypes = {
  name: PropTypes.string,
}

export default Markup;
