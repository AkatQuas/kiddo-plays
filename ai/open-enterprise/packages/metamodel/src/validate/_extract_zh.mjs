import fs from "fs";

const files = ["validate.ts", "instance.ts"];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  let m;
  const lits = [];
  while ((m = re.exec(s))) {
    if (/[\u4e00-\u9fff]/.test(m[0])) lits.push(m[0]);
  }
  console.log("\n===== " + f + " literals " + lits.length + " =====");
  for (const lit of lits) console.log("---\n" + lit);
}
