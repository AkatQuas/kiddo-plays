/**
 * @open-erp/metamodel — six-concept metamodel kernel
 *
 * 🔴 Zero IO: do not import a database, read files, or touch the network. Callers
 * inject anything that needs data (see RuleQuery in primitives.ts). That is why
 * `yarn test` can run every gate offline.
 */

export * from "./schema/common.js";
export * from "./schema/fields.js";
export * from "./normalize/refFilter.js";
// attachment value shape: table creation, the value gate, upload/download, and the control all read one declaration (see the file header)
export * from "./schema/attachment.js";
export * from "./schema/numbering.js";
export * from "./derive/createDefault.js";
export * from "./derive/statusWrite.js";
// Non-null guarantee for a snapshot source: the only check shared by table nullability and the write path's handling of an empty source (see the file header)
export * from "./derive/snapshot.js";
export * from "./schema/effects.js";
// Period axis: which period a ledger row belongs to. A platform axis, not a seventh concept — a module cannot declare it and cannot route around it
export * from "./schema/period.js";
// Ledger catalog mechanism: shape plus proof. The product catalog lives in domains/ledgers/. This package is zero IO.
export * from "./normalize/ledger.js";
export * from "./schema/lifecycle.js";
export * from "./schema/preconditions.js";
export * from "./schema/handoff.js";
export * from "./schema/flow.js";
export * from "./schema/navigation.js";
export * from "./schema/composite.js";
export * from "./schema/access.js";
export * from "./schema/productAuthorization.js";
export * from "./schema/roleGrant.js";
export * from "./schema/permissions.js";
export * from "./schema/systemPermissions.js";
export * from "./schema/views.js";
export * from "./schema/domain.js";
export * from "./schema/dashboard.js";
export * from "./schema/report.js";
export * from "./schema/choiceSet.js";
export * from "./schema/customField.js";
export * from "./schema/effectiveSchema.js";
export * from "./schema/pageLabels.js";
export * from "./schema/moduleSetting.js";
// Custom notifications: rule shape plus the missing-field check. "A notification is not a module", so it lives here and not in module.ts
export * from "./schema/notification.js";
export * from "./normalize/query.js";
export * from "./normalize/analysis.js";
export * from "./normalize/analysisSql.js";
export * from "./derive/pgNames.js";
export * from "./derive/analysisCatalog.js";
export * from "./derive/analysisExample.js";
// Import / export criteria (which columns, what they are called, how a value becomes one cell). The concrete format lives in the server.
// The day the xlsx format is replaced, that one file is what changes. This file does not.
export * from "./transform/exchange.js";
// Planner / ExecutionPlan are runtime values and a restricted capability interface, not a seventh concept on ModuleSchema
export * from "./normalize/planner.js";
export * from "./normalize/actionPreparer.js";
export * from "./normalize/batchAction.js";
export * from "./normalize/surface.js";
export * from "./normalize/pivotSql.js";
// Cross-domain declared aggregation: not a seventh concept, and not a surface. Zero IO. asOf is injected by the caller.
export * from "./normalize/insight.js";
export * from "./normalize/semantic.js";
export * from "./normalize/sqlCell.js";
export * from "./relations/relations.js";
export * from "./relations/creationFlows.js";
// Proactive report: the daily-report data contract (the only interface between the template and the generation logic). Zero IO, types only.
export * from "./report/dailyReportData.js";
// Five-dimension scoring: the deterministic pure-function implementation of the "operating analysis" requirement, kept next to the contract so it can be unit-tested offline.
export * from "./report/scoring.js";
// Multi-level explosion: `views.explosion` declares the coordinates, and this walks the tree and computes quantity. Zero IO, no business names.
// The write path (explode materials on release) and the read path (the tree on the detail page) share it — writing it twice makes the two numbers fight
export * from "./derive/structure.js";
export * from "./derive/creationEligibility.js";
// SourceBinding is the cross-record source IR derived from the six concepts, not a seventh concept on ModuleSchema.
// builder / server / acceptance obligation must consume the same projection through the public entry. Private-path imports are forbidden.
export * from "./relations/sourceBindings.js";
export * from "./derive/operations.js";
export * from "./derive/moduleSearch.js";
export * from "./derive/quickAsk.js";
export * from "./derive/flowCapability.js";
export * from "./derive/flowSignature.js";
export * from "./derive/primitives.js";
// Multi-person quantity allocation: the only pure function for conservation and precision. It does not branch on module code. Not a seventh concept.
export * from "./derive/allocation.js";
export * from "./schema/module.js";
// Field key → the name shown on screen. A rule error must say the display name, not warehouseId
export * from "./derive/labels.js";
export * from "./derive/referenceLabel.js";
// The only implementation of scalar display semantics, so precision and time zone are not written twice.
export * from "./derive/display.js";
export * from "./validate/validate.js";
// Seal entry used only by fixtures: a test has no file path to derive from, so the identity can only be written inline (see the top of each file)
export * from "./validate/fixtureModule.js";
export * from "./validate/fixtureDomain.js";
export * from "./validate/fixtureFlow.js";
export * from "./validate/flow.js";
export * from "./derive/engine.js";
export * from "./derive/trunk.js";
// Instance validation: validate.ts decides whether a declaration holds. This decides whether the data holds.
// The frontend precheck and the server defense must be the same check (consumers such as erp-web or the agent)
export * from "./validate/instance.js";
