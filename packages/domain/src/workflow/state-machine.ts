/**
 * Minimal typed finite-state machine for document lifecycles.
 * Transitions are declared as data so they can be rendered in the UI
 * (available actions) and tested exhaustively.
 */
export interface Transition<S extends string, A extends string> {
  action: A;
  from: readonly S[];
  to: S;
  /** Permission required to perform the transition. */
  permission?: string;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly action: string,
  ) {
    super(`${entity}: cannot "${action}" from status ${from}`);
    this.name = "InvalidTransitionError";
  }
}

export function defineMachine<S extends string, A extends string>(
  entity: string,
  transitions: readonly Transition<S, A>[],
) {
  return {
    entity,
    transitions,
    /** Actions available from a given status. */
    actionsFrom(status: S): A[] {
      return transitions.filter((t) => t.from.includes(status)).map((t) => t.action);
    },
    can(status: S, action: A): boolean {
      return transitions.some((t) => t.action === action && t.from.includes(status));
    },
    /** Returns the next status or throws InvalidTransitionError. */
    next(status: S, action: A): S {
      const t = transitions.find((x) => x.action === action && x.from.includes(status));
      if (!t) throw new InvalidTransitionError(entity, status, action);
      return t.to;
    },
    permissionFor(action: A): string | undefined {
      return transitions.find((t) => t.action === action)?.permission;
    },
  };
}
