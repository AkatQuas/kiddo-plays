/** One read-only repeatable-read transaction; existing query scope compiler only. */
import {sql} from "drizzle-orm";
import {PgDialect} from "drizzle-orm/pg-core";
import {analysisCatalogOf,analysisSnapshotLookupOf,normalizeQuery,queryInputFail,type Query,type QueryNode} from "@open-erp/metamodel";
import {requireIdentity,type Identity,type RuntimeCatalog} from "@open-erp/runtime-core";
import {createRegistry,compileQuery,projection,headerScope} from "./queryCompiler.js";
import {schemasOf,type Executor} from "./support.js";
import type {GeneratedTables} from "./generatedTables.js";
import {boundSql} from "./analysisSqlRepo.js";
import {createHash} from "node:crypto";

export interface SnapshotSource {readonly relation:string;readonly fields:readonly string[];readonly query:Query}
export interface SnapshotIntent {
  readonly text:string;
  readonly references:readonly {readonly from:string;readonly field:string;readonly to:string;readonly key:string;readonly labels:readonly string[]}[];
}
export interface SnapshotExport {readonly snapshotRef:string;readonly capturedAt:string;readonly rows:Readonly<Record<string,number>>;readonly complete:true}
export type SnapshotConsumer=(relation:string,rows:readonly Readonly<Record<string,unknown>>[])=>Promise<void>;
const quote=(name:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error("snapshot catalog contains an illegal identifier");return `"${name}"`;};
const dialect=new PgDialect();
let activeExports=0;
export function createAnalysisSnapshotExporter(exec:Executor,runtime:RuntimeCatalog,timezone:string,tables:GeneratedTables) {
  const schemas=schemasOf(runtime),catalog=analysisCatalogOf([...schemas.values()]);
  return async(identity:Identity,sources:readonly SnapshotSource[],consume:SnapshotConsumer,intent?:SnapshotIntent):Promise<SnapshotExport>=>{
    const who=requireIdentity(identity);
    const registry=createRegistry(schemas,tables);
    if(sources.length<1||sources.length>4)throw Error("a consistency snapshot accepts only 1-4 authorized sources");
    if(activeExports>=1)throw Error("a snapshot export is already running; try again later; it will not take another business connection");
    activeExports++;
    try {
    const started=Date.now();let total=0,bytes=0;
    return await exec.transaction(async tx=>{
      await tx.execute(sql`SET LOCAL statement_timeout='30s'`);
      await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout='30s'`);
      const snapshot=(await tx.execute(sql`SELECT pg_current_snapshot()::text AS snapshot,clock_timestamp()::text AS captured_at`))[0] as Record<string,unknown>;
      await assertSnapshotReferences(tx,registry,catalog,schemas,who,sources,intent,timezone);
      const counts:Record<string,number>={};
      for(let i=0;i<sources.length;i++){
        const source=sources[i]!;const relation=catalog.relations.find(r=>r.name===source.relation);
        if(!relation)throw Error("snapshot source is not in the analysis catalog");
        if(counts[relation.name]!==undefined)throw Error("duplicate snapshot source");
        const module=registry.get(relation.module);
        const selected=source.fields.map(name=>{
          const f=relation.fields.find(c=>c.key===name);
          if(f&&!f.scope)return `${quote(f.column)} AS ${quote(f.key)}`;
          if(relation.grain!=='header'||!analysisSnapshotLookupOf(module.schema,name))throw Error("a snapshot column must come from the storage catalog or a declared header text lookup");
          const keys=[...Object.keys(module.columns),...module.schema.fields.map(f=>f.key)];
          const expr=projection(registry,headerScope(module),{skipKeys:keys.filter(k=>k!==name)})[name];
          if(!expr)throw Error("read-only snapshot relation field has no query projection");
          const compiled=dialect.sqlToQuery(sql`${expr}`);
          if(compiled.params.length)throw Error("a read-only snapshot relation field cannot carry undeclared constant parameters");
          return `${compiled.sql} AS ${quote(name)}`;
        });
        if(!selected.length||selected.length>12||new Set(source.fields).size!==source.fields.length)throw Error("snapshot columns must be 1-12 distinct columns");
        const compiled=compileQuery(registry,module,who,source.query,{timezone});
        const where=dialect.sqlToQuery(compiled.where);
        const filter=relation.grain==="header" ? where.sql : `${quote(relation.name)}.bill_id IN (SELECT ${quote("id")} FROM ${quote(catalog.relations.find(r=>r.module===relation.module&&r.grain==="header")!.name)} WHERE ${where.sql})`;
        const tenant=relation.grain==="line" ? ` AND tenant_id=$${where.params.length+1}` : "";
        const params=relation.grain==="line" ? [...where.params,who.tenantId] : where.params;
        const cursor="asset_export_"+i;
        await tx.execute(boundSql(`DECLARE ${quote(cursor)} NO SCROLL CURSOR FOR SELECT ${selected.join(",")} FROM ${quote(relation.name)} WHERE ${filter}${tenant} ORDER BY id`,params));
        let count=0;
        while(true){
          if(Date.now()-started>30_000)throw Error("snapshot export exceeded the 30-second budget; the whole export is refused");
          const rows=await tx.execute(sql.raw(`FETCH FORWARD 1024 FROM ${quote(cursor)}`)) as unknown as readonly Readonly<Record<string,unknown>>[];
          if(!rows.length)break;
          count+=rows.length;total+=rows.length;bytes+=Buffer.byteLength(JSON.stringify(rows));
          if(total>100_000||bytes>64*1024*1024)throw Error("snapshot export exceeded the 100,000-row or 64MiB budget; a partial extract cannot be published as complete");
          await consume(relation.name,rows);
        }
        await tx.execute(sql.raw(`CLOSE ${quote(cursor)}`));counts[relation.name]=count;
      }
      return {snapshotRef:`pg-snapshot:${String(snapshot["snapshot"])}`,capturedAt:String(snapshot["captured_at"]),rows:counts,complete:true};
    },{isolationLevel:"repeatable read",accessMode:"read only"});
    } finally {activeExports--;}
  };
}

/** Revalidate a reused version's source without exporting or loading any rows. */
export function createAnalysisSnapshotIntentValidator(exec:Executor,runtime:RuntimeCatalog,timezone:string,tables:GeneratedTables) {
  const schemas=schemasOf(runtime),catalog=analysisCatalogOf([...schemas.values()]),registry=createRegistry(schemas,tables);
  return async(identity:Identity,sources:readonly SnapshotSource[],intent:SnapshotIntent):Promise<void>=>{
    const who=requireIdentity(identity);
    await exec.transaction(async tx=>{
      await tx.execute(sql`SET LOCAL statement_timeout='5s'`);
      await assertSnapshotReferences(tx,registry,catalog,schemas,who,sources,intent,timezone);
    },{isolationLevel:"repeatable read",accessMode:"read only"});
  };
}

async function assertSnapshotReferences(tx:Pick<Executor,'execute'>,registry:ReturnType<typeof createRegistry>,catalog:ReturnType<typeof analysisCatalogOf>,schemas:ReturnType<typeof schemasOf>,who:Identity,sources:readonly SnapshotSource[],intent:SnapshotIntent|undefined,timezone:string):Promise<void> {
  // Data-backed coverage check, not a natural-language template matcher.
  // Read only currently authorized labels, in the SAME transaction as export.
  // A mention does not decide eq/ne/comparison: the plan must state that part.
  for(const ref of intent?.references || []) {
    const base=sources.find(s=>s.relation===ref.from),target=catalog.relations.find(r=>r.name===ref.to);
    if(!base || !target || !intent)throw Error("analysis-scope check is missing an authorized source");
    const schema=schemas.get(target.module)!;
    const scope=compileQuery(registry,registry.get(target.module),who,normalizeQuery(schema,{}),{timezone});
    const where=dialect.sqlToQuery(scope.where);
    const labels=ref.labels.map(k=>{const f=target.fields.find(f=>f.key===k);if(!f||f.scope||f.type!=="string")throw Error("analysis-scope label is not an authorized stored text column");return f;});
    const key=target.fields.find(f=>f.key===ref.key);if(!key)throw Error("analysis-scope reference is missing a primary key");
    const mention=labels.map(f=>`(char_length(${quote(f.column)})>=2 AND strpos($${where.params.length+1},${quote(f.column)})>0)`).join(" OR ");
    if(!mention)continue;
    const matches=await tx.execute(boundSql(`SELECT ${quote(key.column)} AS id,${labels.map(f=>quote(f.column)+" AS "+quote(f.key)).join(",")} FROM ${quote(target.name)} WHERE (${where.sql}) AND (${mention}) LIMIT 9`,[...where.params,intent.text])) as unknown as readonly Record<string,unknown>[];
    if(matches.length>8)queryInputFail("ANALYSIS_REFERENCE_SCOPE_AMBIGUOUS","source.sources","the original wording matches more than one record; name the analysis subject first","do not export while dropping an unconfirmed subject condition");
    const ids=matches.map(r=>r['id']);
    if(ids.length && !referencesCovered(base.query.where,ref.field,ids)) {
      queryInputFail("ANALYSIS_REFERENCE_SCOPE_REQUIRED","source.sources.query.where","the join plan omitted a record condition the original wording named this round; no data was exported and no version was published","keep the existing period, status, and other conditions, and state eq/in/ne/not_in for these records in the fact source where; the comparison or exclusion comes from this round's question",{fixable:"machine",valid:matches.map(row=>JSON.stringify({relation:ref.from,field:ref.field,id:row['id'],labels:Object.fromEntries(ref.labels.map(k=>[k,row[k]]))}))});
    }
  }
}

/** Every OR branch must bind the reference; an unrelated branch is not coverage. */
function referencesCovered(node:QueryNode|null,field:string,ids:readonly unknown[]):boolean {
  if(!node)return false;
  if(node.kind==='group')return node.children.length>0 && (node.join==='and'
    ? node.children.some(c=>referencesCovered(c,field,ids))
    : node.children.every(c=>referencesCovered(c,field,ids)));
  if(node.field!==field)return false;
  if(node.op==='eq'||node.op==='ne')return ids.length===1 && node.value===ids[0];
  if(node.op==='in'||node.op==='not_in')return Array.isArray(node.value) && node.value.length===ids.length && ids.every(id=>(node.value as unknown[]).includes(id));
  return false;
}

export function analysisSnapshotScope(runtime:RuntimeCatalog,timezone:string,tables:GeneratedTables,identity:Identity,sources:readonly SnapshotSource[]):string {
  const registry=createRegistry(schemasOf(runtime),tables);
  const scopes=sources.map(source=>{const relation=analysisCatalogOf([...schemasOf(runtime).values()]).relations.find(r=>r.name===source.relation);if(!relation)throw Error("unknown snapshot source");const compiled=compileQuery(registry,registry.get(relation.module),requireIdentity(identity),source.query,{timezone});return {source,where:dialect.sqlToQuery(compiled.where)};});
  return createHash("sha256").update(JSON.stringify(scopes)).digest("hex");
}
