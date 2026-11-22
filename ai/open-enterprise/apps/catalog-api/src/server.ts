import path from "node:path";
import { fileURLToPath } from "node:url";
import { startShowcaseServer } from "../../../packages/loader/src/showcase-server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const port = Number(process.env["PORT"] ?? 8091);

const server = await startShowcaseServer({
  manufacturing: process.env["OE_MANUFACTURING_DOMAINS"] ?? path.join(root, "domains"),
  commerce: process.env["OE_COMMERCE_DOMAINS"] ?? path.join(root, "showcases/commerce/domains"),
}, port);

const address = server.address();
const bound = typeof address === "object" && address ? address.port : port;
console.log(`showcase api listening on ${bound}`);
