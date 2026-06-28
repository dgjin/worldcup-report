import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

assert.match(appSource, /HelpButton/, "header should render the help button");
assert.match(appSource, /RefreshCw/, "header should keep the manual refresh button");
assert.match(appSource, /reload/, "manual refresh button should call the data reload handler");

console.log("App header controls test passed");
