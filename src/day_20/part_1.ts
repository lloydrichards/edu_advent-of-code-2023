import { flow, pipe } from "fp-ts/lib/function";
import * as S from "@fp-ts/string";
import * as RA from "fp-ts/ReadonlyArray";
import * as R from "fp-ts/Record";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";

import input from "./input/input.txt";
import { traceWithValue } from "fp-ts-std/Debug";
enum ModuleType {
  "FLIP_FLOP",
  "BROADCASTER",
  "CONJUNCTION",
}
type BroadcastState = {
  type: ModuleType.BROADCASTER;
  dest: Array<string>;
};
type FlipFlopState = {
  type: ModuleType.FLIP_FLOP;
  state: boolean;
  dest: Array<string>;
};
type ConjunctionState = {
  type: ModuleType.CONJUNCTION;
  memory: Record<string, boolean>;
  dest: Array<string>;
};
type ModuleState = BroadcastState | FlipFlopState | ConjunctionState;
type Pulse = [string, string, boolean];
type ConfigState = {
  config: Record<string, ModuleState>;
  queue: Array<Pulse>;
  high: number;
  low: number;
};

const parseModule: (s: string) => [string, ModuleState] = flow(
  S.split(" -> "),
  ([type, destinations]) => [
    type !== "broadcaster" ? type.slice(1) : type,
    {
      ...(type !== "broadcaster"
        ? type.slice(0, 1) == "%"
          ? { type: ModuleType.FLIP_FLOP, state: false }
          : { type: ModuleType.CONJUNCTION, memory: {} }
        : { type: ModuleType.BROADCASTER }),
      dest: destinations.split(", "),
    },
  ],
);
const parseConfig = flow(
  S.split("\n"),
  RA.map(parseModule),
  RA.toArray,
  R.fromEntries,
  (config) =>
    pipe(
      config,
      R.mapWithIndex((key, m) =>
        m.type === ModuleType.CONJUNCTION
          ? {
              ...m,
              memory: {
                ...Object.fromEntries(
                  Object.entries(config)
                    .filter(([_, { dest }]) => dest.includes(key))
                    .map(([k]) => [k, false]),
                ),
              },
            }
          : m,
      ),
    ),
);

const pulseReducer =
  (state: ConfigState) =>
  ([from, to, value]: Pulse): ConfigState => {
    //   console.log(`${from} -${value}-> ${to}`);
    const destModule = state.config[to];
    if (!destModule) {
      return {
        ...state,
        high: state.high + (value ? 1 : 0),
        low: state.low + (!value ? 1 : 0),
        queue: state.queue.slice(1),
      };
    }

    switch (destModule.type) {
      case ModuleType.BROADCASTER:
        return {
          config: state.config,
          high: state.high + (value ? 1 : 0),
          low: state.low + (!value ? 1 : 0),
          queue: [
            ...state.queue.slice(1),
            ...destModule.dest.map((d) => [to, d, value] as Pulse),
          ],
        };
      case ModuleType.FLIP_FLOP:
        if (value) {
          return {
            ...state,
            high: state.high + (value ? 1 : 0),
            low: state.low + (!value ? 1 : 0),
            queue: state.queue.slice(1),
          };
        }
        return {
          config: {
            ...state.config,
            [to]: { ...destModule, state: !destModule.state },
          },
          high: state.high + (value ? 1 : 0),
          low: state.low + (!value ? 1 : 0),
          queue: [
            ...state.queue.slice(1),
            ...destModule.dest.map((d) => [to, d, !destModule.state] as Pulse),
          ],
        };
      case ModuleType.CONJUNCTION:
        const updatedMemory = { ...destModule.memory, [from]: value };
        if (Object.values(updatedMemory).every(Boolean)) {
          return {
            config: {
              ...state.config,
              [to]: { ...destModule, memory: updatedMemory },
            },
            high: state.high + (value ? 1 : 0),
            low: state.low + (!value ? 1 : 0),
            queue: [
              ...state.queue.slice(1),
              ...destModule.dest.map((d) => [to, d, false] as Pulse),
            ],
          };
        }
        return {
          config: {
            ...state.config,
            [to]: { ...destModule, memory: updatedMemory },
          },
          high: state.high + (value ? 1 : 0),
          low: state.low + (!value ? 1 : 0),
          queue: [
            ...state.queue.slice(1),
            ...destModule.dest.map((d) => [to, d, true] as Pulse),
          ],
        };
    }
  };

const firePulse = (state: ConfigState): ConfigState =>
  pipe(
    state.queue,
    // traceWithValue("queue:"),
    O.fromPredicate(A.isNonEmpty),
    O.match(
      () => state,
      (queue) => pipe(queue[0], pulseReducer(state), firePulse),
    ),
  );

const pushButton = (times: number) => (config: Record<string, ModuleState>) =>
  pipe(
    Array.from({ length: times }),
    A.reduce({ config, high: 0, low: 0, queue: [] } as ConfigState, (state) =>
      firePulse({ ...state, queue: [["button", "broadcaster", false]] }),
    ),
  );

export const main = (press: number) => (input: string) =>
  pipe(
    input,
    parseConfig,
    pushButton(press),
    ({ high, low }) => high * low,
  );

// console.log(main(1000)(input)); // Output: 919383692
