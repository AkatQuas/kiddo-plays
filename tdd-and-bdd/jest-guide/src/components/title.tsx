import React, { CSSProperties } from 'react';

interface TitleProps {
  type: 'large' | 'small';
  title: string;
}

const largeStyle: CSSProperties = {
  fontSize: '2em',
  color: 'red',
};

const smallStyle: CSSProperties = {
  fontSize: '0.5em',
  color: 'green',
};

const styleMapper: Record<'small' | 'large', CSSProperties> = {
  small: smallStyle,
  large: largeStyle,
};

export const Title = (props: TitleProps) => {
  const { title, type } = props;

  return <p style={styleMapper[type]}>{title}</p>;
};
