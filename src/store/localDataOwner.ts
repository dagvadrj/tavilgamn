/**
 * The signed-in user who owns locally saved data (room designs, kitchens).
 * Auth announces it here instead of importing those stores: they pull in the
 * room and kitchen planners, and auth runs in the root layout of every page.
 * A store registers when its module first loads and hears the current owner.
 */
type Listener = (owner: string | null) => void;

const listeners = new Set<Listener>();
let announced = false;
let current: string | null = null;

export function announceLocalDataOwner(owner: string | null) {
  announced = true;
  current = owner;
  listeners.forEach((listener) => listener(owner));
}

export function onLocalDataOwner(listener: Listener) {
  listeners.add(listener);
  if (announced) listener(current);
}
