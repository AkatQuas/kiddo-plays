import { sleep } from '@shared/time';
import { fetchUserInfo } from '../api/user';
import { cookieStore, userStore } from '../stores/userStore';
import { windowManager } from '../windows/index';
import { registerMainHandle } from './register';

export const registerAuthHandlers = () => {
  registerMainHandle('auth.login', async (_event, args) => {
    console.debug('\x1B[97;100;1m --- login args --- \x1B[m', '\n', args);
    await sleep(1000);
    try {
      const data = await fetchUserInfo();
      userStore.set('userId', data.userId);
    } catch (error) {
      throw new Error(`获取用户信息失败 ${error}`);
    }

    windowManager.close('login');
    windowManager.show('main');
  });

  registerMainHandle('auth.logout', async () => {
    cookieStore.clear();

    userStore.set('userId', null);
    windowManager.close('main');
    windowManager.show('login');
  });
};
