/**
 * Generates api/tests/parity_golden.json — canonical TS engine outputs for a
 * fixture set. The Python test test_parity.py replays the same inputs through
 * the Python port and asserts byte-identical deterministic fields.
 *
 * Non-deterministic fields (pipelineId, timestamp) are stripped before dumping.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { govern } from "@/lib/governance-engine";

const FIXTURES_PATH = join(process.cwd(), "api/tests/parity_fixtures.json");
const GOLDEN_PATH = join(process.cwd(), "api/tests/parity_golden.json");

function stripNonDeterministic(result: any): any {
  const { pipelineId: _p, timestamp: _t, ...rest } = result;
  return rest;
}

describe("Parity Golden Dump", () => {
  it("writes golden file for all fixtures", () => {
    const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8"));
    const golden: Record<string, any> = {};
    for (const f of fixtures) {
      const result = govern(f.assessment, f.business, f.financial, f.relational, f.decision);
      golden[f.name] = stripNonDeterministic(result);
    }
    writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + "\n");
    expect(Object.keys(golden)).toHaveLength(fixtures.length);
  });
});
