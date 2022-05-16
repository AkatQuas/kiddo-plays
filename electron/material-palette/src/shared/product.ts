import { production } from 'electron-is';
import * as path from 'path';
import { ProductInfo } from '../typings';

export const productInfo: ProductInfo = {
  name: 'MaterialPalette',
  width: 370,
  height: 410,
  icon: path.resolve(__dirname, 'assets', 'icon.png'),
  entry: production()
    ? path.resolve(__dirname, 'renderer.html')
    : 'http://localhost:4200/renderer.html',
};
