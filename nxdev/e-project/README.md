# EProject

This project was created with [Nx](https://nx.dev) and [strategic design project](https://github.com/manfredsteyer/strategic-design).

## Categories for Libraries

The Nx team recommends to categorize libraries as follows:

- **feature**: Implements a use case with smart components.
- **data-access**: Implements data accesses, e.g. via HTTP or WebSockets
- **ui**: Provides use case-agnostic and thus reusable components (dumb components).
- **util**: Provides helper functions.

- **shell**: For an application that has multiple domains, a shell provides the entry point for a domain.
- **api**: Provides functionalities exposed to other domains.
- **domain**: Domain logic like calculating additional expenses, validations or facades for use cases and state management.

## Development

Generate these libraries after defining the module boundaries in [.eslintrc.json](./.eslintrc.json).

```bash
nx generate lib feature-request-product --directory catalog --tags scope:catalog,type:feature

nx generate lib feature-browse-product --directory catalog --tags scope:catalog,type:feature

nx generate lib api --directory catalog --tags scope:catalog,type:api,name:catalog-api

nx generate lib shell --directory catalog --tags scope:catalog,type:shell

nx generate lib data-access --directory catalog --tags scope:catalog,type:data-access

nx generate lib shell --directory ordering --tags scope:ordering,type:shell

nx generate lib feature-send-order --directory ordering --tags scope:ordering,type:feature

nx generate lib util-auth --directory shared --tags scope:shared,type:util

nx generate lib ui-address --directory shared --tags scope:shared,type:ui
```
