import dashboard from '../public/dashboard.html';
import homepage from '../public/home.html';

const PORT = parseInt(process.env.PORT || '8080');

export const app: Bun.Serve.Options<undefined> = {
  port: PORT,
  routes: {
    // ** HTML imports **
    // Bundle & route index.html to "/". This uses HTMLRewriter to scan
    // the HTML for `<script>` and `<link>` tags, runs Bun's JavaScript
    // & CSS bundler on them, transpiles any TypeScript, JSX, and TSX,
    // downlevels CSS with Bun's CSS parser and serves the result.
    '/': homepage,
    // Bundle & route dashboard.html to "/dashboard"
    '/dashboard': dashboard,

    // Static routes
    '/api/healthy': new Response(),

    // Dynamic routes
    '/users/:id': (req) => {
      return new Response(`Hello User ${req.params.id}!`);
    },

    '/api/dice': (req) => {
      const url = new URL(req.url);

      // Get query values
      const min = parseInt(url.searchParams.get('min') ?? '2');
      const max = parseInt(url.searchParams.get('max') ?? '10');
      const num = Math.floor(Math.random() * (max - min + 1) + min);
      return new Response(`${num}`);
    },

    // Per-HTTP method handlers
    '/api/posts': {
      GET: () => new Response('List posts'),
      POST: async (req) => {
        const body = (await req.json()) as Record<string, unknown>;
        return Response.json({ created: true, ...body });
      }
    },

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    '/api/*': Response.json({ message: 'Not found' }, { status: 404 }),

    // Redirect from /blog/hello to /blog/hello/world
    '/blog/hello': Response.redirect('/blog/hello/world'),

    // Serve a file by lazily loading it into memory
    '/favicon.ico': Bun.file('./favicon.ico')
  },

  // (optional) fallback for unmatched routes:
  // Required if Bun's version < 1.2.3
  fetch(req) {
    return new Response('Not Found', { status: 404 });
  }
};

// Only start server if running as main (not in tests)
if (import.meta.main) {
  const server = Bun.serve(app);
  console.log(`Server running at ${server.url}`);
}
