import { defineDomain } from "@open-erp/metamodel";

// the directory name is the domain code, and `d-1` is not a legal coordinate segment — the declaration has nowhere to write a code,
// the only thing left to stop it is the shape gate at the injection point
export default defineDomain({ label: "domain with a malformed directory name" });
