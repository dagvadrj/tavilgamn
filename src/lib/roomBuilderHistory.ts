import { validateRoomBuilder, type RoomBuilderDraft } from "./roomBuilderDraft";

export type RoomBuilderHistory = {
  draft: RoomBuilderDraft;
  past: RoomBuilderDraft[];
  future: RoomBuilderDraft[];
  baseline: RoomBuilderDraft | null;
  error: string | null;
};
export type RoomBuilderAction =
  | { type: "change"; draft: RoomBuilderDraft }
  | { type: "begin" | "end" | "cancel" | "undo" | "redo" };

export function createRoomBuilderHistory(
  draft: RoomBuilderDraft,
): RoomBuilderHistory {
  return {
    draft: structuredClone(draft),
    past: [],
    future: [],
    baseline: null,
    error: null,
  };
}
const same = (a: RoomBuilderDraft, b: RoomBuilderDraft) =>
  JSON.stringify(a) === JSON.stringify(b);
const append = (past: RoomBuilderDraft[], draft: RoomBuilderDraft) =>
  [...past, structuredClone(draft)].slice(-60);

/** A gesture is local to the draft and becomes a single undo step on completion. */
export function reduceRoomBuilderHistory(
  state: RoomBuilderHistory,
  action: RoomBuilderAction,
): RoomBuilderHistory {
  switch (action.type) {
    case "begin":
      return state.baseline
        ? state
        : { ...state, baseline: structuredClone(state.draft), error: null };
    case "change": {
      const error = validateRoomBuilder(action.draft);
      if (error) return { ...state, error };
      if (same(state.draft, action.draft)) return { ...state, error: null };
      return {
        ...state,
        draft: structuredClone(action.draft),
        error: null,
        past: state.baseline ? state.past : append(state.past, state.draft),
        future: state.baseline ? state.future : [],
      };
    }
    case "end":
      if (!state.baseline) return state;
      return {
        ...state,
        baseline: null,
        past: same(state.baseline, state.draft)
          ? state.past
          : append(state.past, state.baseline),
        future: same(state.baseline, state.draft) ? state.future : [],
      };
    case "cancel":
      return {
        ...state,
        draft: state.baseline ?? state.draft,
        baseline: null,
        error: null,
      };
    case "undo": {
      if (state.baseline)
        return reduceRoomBuilderHistory(state, { type: "cancel" });
      const draft = state.past.at(-1);
      return draft
        ? {
            ...state,
            draft,
            past: state.past.slice(0, -1),
            future: [state.draft, ...state.future],
            error: null,
          }
        : state;
    }
    case "redo": {
      if (state.baseline) return state;
      const draft = state.future[0];
      return draft
        ? {
            ...state,
            draft,
            past: append(state.past, state.draft),
            future: state.future.slice(1),
            error: null,
          }
        : state;
    }
  }
}
