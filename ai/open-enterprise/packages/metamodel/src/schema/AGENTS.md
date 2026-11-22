# schema

`packages/metamodel` does no IO. It does not read files, use the network, open a database, or read the environment. Disk scans live in `packages/loader`.

Do not pass a module that already carries `postsToLedger` through `defineModule` or `normalizeModule` again. Derived keys are outside the closed key set, and a second pass rejects the module.

Confirmation looks at the derived `postsToLedger` and `expandsBills`. Do not decide from whether this run's plan is empty. Writing either key in a declaration is rejected. The loader fills `expandsBills` with `withPlannerExpansion`. `normalizeLifecycle` does not.

Flow codes may contain hyphens (`flow.ts`, `CODE_SHAPE`). Module codes are lowerCamel (`requireCoordinateSegment`). Do not use one shape check for both.
