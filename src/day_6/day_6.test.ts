import { describe, expect, test } from "bun:test";
import example from "./input/example.txt";
import { main as partOne } from "./part_1.ts";
import { main as partTwo } from "./part_2.ts";

describe("AoC: Day 6", () => {
  test("part 1", async () => {
    expect(partOne(example)).toBe(288);
  });
  test("part 2", async () => {
    expect(partTwo(example)).toBe(71503);
  });
});
