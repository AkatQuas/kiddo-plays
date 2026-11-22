import { beforeEach } from "vitest";
import { installLedgerCatalog } from "../src/index.js";
import { ledgers } from "../../../domains/ledgers/ledgers.js";

/** Read paths only recognize an installed catalog. An uninstalled catalog no longer falls back to the kernel table; tests get the product ledger catalog by default. */
installLedgerCatalog(ledgers);

/** A case that tests "not installed" calls `installLedgerCatalog(null)` itself; the next case installs it again. */
beforeEach(() => {
  installLedgerCatalog(ledgers);
});
