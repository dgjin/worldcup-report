import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./GroupStandings.tsx", import.meta.url), "utf8");

assert.match(source, /const \{\s*visits\s*,\s*loading\s*\} = useVisits\(\)/, "VisitCounter should read visit state");
assert.match(source, /已被访问 \$\{visits\.toLocaleString\(\)\} 次/, "VisitCounter should render the visit count");
assert.doesNotMatch(source, /function VisitCounter\(\)\s*\{\s*useVisits\(\);\s*return null;\s*\}/s, "VisitCounter should not be a hidden recorder");

console.log("GroupStandings visit counter test passed");
