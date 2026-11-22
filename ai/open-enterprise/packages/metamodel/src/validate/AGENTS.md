# validate

Keep the three checks separate. `validateModule` cannot see other modules. Whether a push target exists, whether a surface's derived `reads` ledger exists, and whether a code is duplicated are decided in the loader's `cross-validation.ts`. Whether an edge can be taken now is decided in `derive/engine`, not here.

A record is valid only through `checkNewBill`, `checkBillPatch`, and `checkGeneratedBill`. Do not write another copy for a form or a repository.

A flow `fatal` fails the load. A `gap` is recorded. Do not treat a gap as a load failure.
