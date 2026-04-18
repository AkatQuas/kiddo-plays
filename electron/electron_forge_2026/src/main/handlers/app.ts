import { PLATFORM } from '@shared/constants';
import { registerMainHandle } from './register';

export const registerAppHandlers = () => {
  registerMainHandle('app.platform', () => {
    return PLATFORM.IS_MAC ? 'macos' : 'windows';
  });
};
