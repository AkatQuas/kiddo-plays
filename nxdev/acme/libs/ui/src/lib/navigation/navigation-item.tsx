import { LiHTMLAttributes } from 'react';
import styled from 'styled-components';

const StyledNavigationItem = styled.li`
  &:not(:last-of-type) {
    margin-right: 1rem;
  }
`;

export const NavigationItem = (props: LiHTMLAttributes<HTMLLIElement>) => (
  <StyledNavigationItem>{props.children}</StyledNavigationItem>
);

export default NavigationItem;
