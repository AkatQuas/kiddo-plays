import React from 'react';

const style = {
  width: '100%',
  height: 'auto',
  minHeight: '100px',
  margin: '10px auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};
export const CenterBox = ({ children }) => <div style={style}>{children}</div>;
