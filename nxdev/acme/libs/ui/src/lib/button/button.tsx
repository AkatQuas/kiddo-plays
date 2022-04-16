import { ButtonHTMLAttributes } from 'react';
import styled from 'styled-components';

const StyledButton = styled.button`
  font-size: 0.8rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  background-color: #fafafa;
  cursor: pointer;
  border-radius: 4px;
  &:hover {
    background-color: #80a8e2;
    border-color: #80a8e2;
    color: #eee;
  }
`;

export const Button = ({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <StyledButton {...rest}>{children}</StyledButton>
);

export default Button;
