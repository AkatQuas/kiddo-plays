import { rest } from 'msw';

export const userApiMock = [
  // static response
  rest.get('https://any-site.com/api/role', async (req, res, ctx) => {
    res(
      ctx.status(200),
      ctx.json({
        role: 'user',
      })
    );
  }),
];
