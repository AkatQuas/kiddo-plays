import { configureStore } from '@reduxjs/toolkit';
import {
  render as TRender,
  RenderOptions as TRenderOptions,
} from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import type { RootState } from 'store/root';
import { reducer } from 'store/root';

interface RenderOptions extends TRenderOptions {
  preloadedState?: RootState;
  store?: ReturnType<typeof configureStore>;
}

export const render = (ui: React.ReactElement, options: RenderOptions) => {
  const {
    preloadedState = {},
    store = configureStore({ reducer, preloadedState }),
    ...renderOptions
  } = options;

  const Wrapper: React.FC = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return TRender(ui, { wrapper: Wrapper, ...renderOptions });
};
