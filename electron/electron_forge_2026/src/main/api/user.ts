import { sleep } from '@shared/time';

/**
 * fetch user info from remote
 */
export const fetchUserInfo = async () => {
  await sleep(1000);
  const data = { userId: 'jack_at abc' };

  return data;
};
