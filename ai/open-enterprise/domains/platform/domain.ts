import { defineDomain } from "@open-erp/metamodel";

/**
 * Platform accounts. Not the production-worker master, and not an org directory from the identity gateway.
 * A new domain for the loader needs a workspace package, domain.ts, modules/, and a root
 * tsconfig reference. Login accounts do not live in manufacturing, and the ops / system
 * support domains do not start emitting modules.
 */
export default defineDomain({
  label: "Platform",
});
