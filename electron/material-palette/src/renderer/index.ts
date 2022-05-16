import { clipboard } from 'electron';
import 'hint.css/hint.min.css';
import throttle from 'lodash-es/throttle';
import { convertRGBToHex, luminance } from '../shared/colors';
import { populatePalette } from './color-palette';
import './style.less';
import { showToast } from './toast';

const CONTAINER_WIDTH = 370;
const TOOLTIP_WIDTH = 140;
const TOOLTIP_HEIGHT = 40;
const State = {
  type: 'hex',
  lastTooltip: 0,
};

// Populate color cells
const container = document.querySelector('div#container') as HTMLDivElement;
populatePalette(container);

// Track tooltip movement and display a color + info
document.body.addEventListener(
  'mousemove',
  throttle((e) => {
    const tooltip = document.querySelector('div#tooltip') as HTMLDivElement;
    const node = findColorCell(e);
    if (!node) {
      tooltip.classList.add('hidden');
      return;
    }

    State.lastTooltip = performance.now();
    const rgb = node.style.backgroundColor;
    const series = node.getAttribute('data-series');
    const hex = convertRGBToHex(rgb);
    if (!hex) {
      return;
    }

    let value: string;
    switch (State.type) {
      case 'rgb':
        value = rgb;
        break;
      case 'hex':
        value = hex;
        break;
      default:
        value = rgb;
        break;
    }
    tooltip.style.backgroundColor = value;
    tooltip.innerHTML = `<span style='font-size:1.2em'>${value}</span>${series}`;

    tooltip.style.color = luminance(hex, '#fff', '#000');
    // Adjust bounds of tooltip to avoid edge bleeding
    let offsetX = e.clientX - TOOLTIP_WIDTH / 2;
    let offsetY = e.clientY - TOOLTIP_HEIGHT - 10;
    if (offsetX < 0) {
      offsetX = e.clientX + 30;
    } else if (offsetX > CONTAINER_WIDTH - TOOLTIP_WIDTH) {
      offsetX -= 65;
    }
    if (offsetY < 0) {
      offsetY = e.clientY + 25;
    }
    tooltip.style.top = offsetY + 'px';
    tooltip.style.left = offsetX + 'px';
    tooltip.classList.remove('hidden');
  })
);

setInterval(function () {
  if (performance.now() - State.lastTooltip >= 2000) {
    document.querySelector('div#tooltip')!.classList.add('hidden');
  }
}, 2000);

document.body.addEventListener('click', (e) => {
  const node = findColorCell(e);
  if (!node) {
    return;
  }
  const rgb = node.style.backgroundColor;
  const hex = convertRGBToHex(rgb);

  if (!hex) {
    return;
  }
  clipboard.writeText(State.type === 'hex' ? hex : rgb);
  showToast('Copied to clipboard!');
});

document.querySelector('div#mode-toggle')!.addEventListener('click', () => {
  const next = State.type === 'hex' ? 'rgb' : 'hex';
  document.querySelector('div#current-output')!.innerHTML = next.toUpperCase();
  State.type = next;
});

/* utilities */

function findColorCell(e: MouseEvent) {
  let node: HTMLElement = e.target as HTMLElement;
  if (node.classList.contains('color')) {
    return node;
  }

  let parent: HTMLElement | null = node.parentNode as any;
  if (parent && parent.classList.contains('color')) {
    return parent;
  }
  return null;
}
