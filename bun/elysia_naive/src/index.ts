import { Elysia, t, validationDetail } from 'elysia';

class NicheError extends Error {
  status = 418;
  constructor(message: string) {
    super(message);
  }
  toResponse() {
    return { message: this.message };
  }
}

const nameCheck = new Elysia().onBeforeHandle(
  { as: 'scoped' },
  ({ query: { name }, status }) => {
    if (!name) return status(401);
  }
);

const ageCheck = new Elysia().guard({
  as: 'global',
  query: t.Object({
    age: t.Number(),
    name: t.Optional(t.String())
  }),
  beforeHandle({ query: { age }, status }) {
    if (age < 18) return status(403);
  }
});

const name = new Elysia().use(nameCheck).patch('/rename', () => 'Ok! XD');
const profile = new Elysia()
  .use(ageCheck)
  .use(name)
  .get('/profile', () => 'Hi!');

const app = new Elysia({})
  .onError(({ code, status }) => {
    if (code === 'NOT_FOUND') return 'uhe~ are you lost?';
    return status(418, "My bad! But I'm cute so you'll forgive me, right?");
  })
  .onBeforeHandle(({ request, status, headers }) => {
    const auth = headers['Authorization'];
    // jwt
    console.log('This is executed before handler');
  })
  .guard({
    beforeHandle: [
      ({ query: { name }, status }) => {
        if (!name) return status(401);
      },
      ({ query: { name } }) => {
        console.log(name);
      }
    ],
    afterResponse({ responseValue }) {
      console.log(responseValue);
    },
    query: t.Object({
      name: t.String()
    })
  })
  .get(
    '/',
    ({ set, cookie: { visit } }) => {
      set.headers['x-powered-by'] = 'Elysia2026'!;

      visit.value ??= 0;
      visit.value++;
      visit.httpOnly = true;
      visit.path = '/';
      visit.set({
        sameSite: 'lax',
        secure: true,
        maxAge: 60 * 60 * 24 * 7
      });
      // visit.remove();

      return 'Hello Elysia!';
    },
    {
      beforeHandle({ request, status }) {
        console.log('This is executed before handler');
        if (Math.random() <= 0.5)
          return status(418, { message: "I'm a teapot" });
      },
      response: {
        200: t.Literal('Hello Elysia!'),
        418: t.Object({
          message: t.Literal("I'm a teapot")
        })
      },
      cookie: t.Cookie(
        {
          visit: t.Optional(t.Number())
        },
        {
          secrets: 'Fischl von Luftschloss Narfidort',
          sign: ['visit']
        }
      )
    }
  )

  .post(
    '/',
    ({ body, query, headers }) => {
      return { body, query, headers };
    },
    {
      body: t.Object(
        {
          age: t.Number({
            error: validationDetail('Age must be a number')
          })
        },
        {
          error: validationDetail('Body must be an object')
        }
      )
    }
  )
  .get('/docs', ({ redirect }) => redirect('https://elysiajs.com'))
  .post('/user', ({ body: { name } }) => `Hello ${name}!`, {
    body: t.Object({
      name: t.String(),
      age: t.Number()
    })
  })
  .get('/friends/:name', ({ params: { name } }) => `Hello ${name}`)
  .get('/user/:id', ({ params: { id } }) => id)
  .post('/form', ({ body }) => body)
  .use(profile)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
