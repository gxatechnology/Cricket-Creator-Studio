export const MAX_HISTORY_STEPS = 40;

export interface HistoryStack<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistoryState<T>(initial: T): HistoryStack<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushHistoryState<T>(
  stack: HistoryStack<T>,
  nextPresent: T,
  maxSteps = MAX_HISTORY_STEPS
): HistoryStack<T> {
  const nextPast = [...stack.past, stack.present];
  if (nextPast.length > maxSteps) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    present: nextPresent,
    future: [],
  };
}

export function undoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1];
  const nextPast = stack.past.slice(0, stack.past.length - 1);
  return {
    past: nextPast,
    present: previous,
    future: [stack.present, ...stack.future].slice(0, MAX_HISTORY_STEPS),
  };
}

export function redoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0];
  const nextFuture = stack.future.slice(1);
  return {
    past: [...stack.past, stack.present].slice(-MAX_HISTORY_STEPS),
    present: next,
    future: nextFuture,
  };
}
