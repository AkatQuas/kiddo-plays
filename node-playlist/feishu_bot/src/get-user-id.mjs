import { getClient } from './client.mjs';
import { writeConstantJson } from './constant.mjs';

/** fetch the union_id for user */
const getUserID = async () => {
  const client = getClient();

  const { data } = await client.contact.user.batchGetId({
    data: {
      mobiles: [process.env.MY_PHONE]
    },
    params: {
      user_id_type: 'union_id'
    }
  });

  const { user_list } = data;
  const ME = user_list[0];
  if (ME && ME.user_id) {
    const json = { USER_ID: ME.user_id };
    await writeConstantJson(json);
  }
};

getUserID();
