import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* Guards the mistake that took the dashboard down.

   A `const` referenced above its own declaration is a temporal dead zone
   error. It compiles perfectly and throws the moment the component renders,
   so a green build says nothing about it, and the crash reaches whoever opens
   the app next.

   Only immediate references count. A name used inside an event handler or an
   effect is fine however late it is declared, because that code runs long
   after the declarations have all been evaluated. A useMemo factory and its
   dependency array are different: both run during render, in order. */

const SOURCE = "app/app/page.jsx";

/* Comments and strings hold words that look like identifiers but are not.

   Blanked rather than deleted. Collapsing a multi-line comment to a single
   space joins the code above it to the code below, which moves declarations
   off the start of their line and makes this whole check quietly match
   nothing. It did exactly that on the first attempt. */
const blank = (m) => m.replace(/[^\n]/g, " ");

function strip(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, blank);
}

/* Top level function blocks, which in this file is every component. */
function functionBlocks(lines) {
  const blocks = [];
  let start = null, name = null;
  lines.forEach((line, i) => {
    const open = line.match(/^function (\w+)/);
    if (open) { start = i; name = open[1]; return; }
    if (start !== null && line === "}") { blocks.push({ name, start, end: i }); start = null; }
  });
  return blocks;
}

test("no declaration in a component reads a const declared below it", () => {
  const lines = strip(fs.readFileSync(SOURCE, "utf8")).split("\n");
  const problems = [];

  for (const block of functionBlocks(lines)) {
    // Declarations at the top level of the function body.
    const decls = [];
    for (let i = block.start; i < block.end; i++) {
      const m = lines[i].match(/^  const (\w+)\s*=/);
      if (m) decls.push({ name: m[1], line: i });
    }
    const declaredAt = new Map(decls.map((d) => [d.name, d.line]));

    decls.forEach((d, idx) => {
      const stop = idx + 1 < decls.length ? decls[idx + 1].line : block.end;
      const body = lines.slice(d.line, stop).join("\n");

      // Everything here evaluates during render, unlike a handler or an effect.
      const runsNow = !/^\s*const \w+\s*=\s*(async\s*)?\(?[\w,\s{}]*\)?\s*=>/.test(lines[d.line])
        || /useMemo\(/.test(body);
      if (!runsNow) return;

      /* Property keys and member access read like variables and are not.
         `{ cost: 12 }` and `row.cost` say nothing about a `const cost`. The
         leading punctuation is what separates an object key from the middle
         of a ternary, where the name genuinely is a reference. */
      const refs = body
        .replace(/([{,]\s*)[A-Za-z_$][\w$]*\s*:/g, "$1")
        .replace(/\.\s*[A-Za-z_$][\w$]*/g, "");

      for (const ref of refs.match(/\b[A-Za-z_$][\w$]*\b/g) || []) {
        if (ref === d.name) continue;
        const at = declaredAt.get(ref);
        if (at !== undefined && at > d.line) {
          problems.push(`${block.name}: "${d.name}" (line ${d.line + 1}) reads "${ref}", declared later on line ${at + 1}`);
        }
      }
    });
  }

  // One line per problem, however many times the name appears in the body.
  const unique = [...new Set(problems)];
  assert.deepEqual(unique, [], "\n" + unique.join("\n"));
});
