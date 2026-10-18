import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("lib/analyze.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { analyzeText, createStyleProfile } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64")
);
const empty = analyzeText("");
assert.equal(empty.words, 0);
assert.equal(empty.paragraphs.length, 0);
const example = "Fontos megjegyezni, hogy az oktatásban több megoldás létezik. Továbbá ezek különböző helyzetekben segíthetnek. Ugyanakkor a tanár döntése továbbra is fontos.\n\nA konyhai gyakorlaton három tanuló dolgozott, és a munkafolyamatokat önállóan dokumentálták.";
const result = analyzeText(example);
assert.ok(result.words > 20);
assert.equal(result.paragraphs.length, 2);
assert.ok(result.score >= 0 && result.score <= 100);
assert.ok(result.paragraphs.every(p => p.score >= 0 && p.score <= 100 && p.reasons.length > 0));
assert.equal(createStyleProfile("rövid minta"), null);
const longText = Array.from({ length: 160 }, (_, i) => `A tanuló a ${i + 1}. feladatot elvégezte, a műveleteket ellenőrizte, és rögzítette az eredményt.`).join("\n");
const longResult = analyzeText(longText);
assert.equal(longResult.paragraphs.length, 160);
assert.ok(Number.isFinite(longResult.score));
console.log("Smoke tests passed: empty, paragraph, score range, profile threshold, long document.");
