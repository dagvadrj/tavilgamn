/** Keep a demand canvas asleep while unavailable, and explicitly draw after a
 * restored WebGL context. Three recreates GL state but does not schedule R3F. */
export function bindCanvasLifecycle({
  canvas, visibility, paused, isContextLost, setLoop, refresh, onUnavailable,
}: {
  canvas: EventTarget;
  visibility: EventTarget & { readonly hidden: boolean };
  paused: boolean;
  isContextLost: () => boolean;
  setLoop: (mode: "never" | "demand") => void;
  refresh: () => void;
  onUnavailable: (lost: boolean) => void;
}) {
  let lost = isContextLost();
  const sync = () => {
    const sleeping = paused || visibility.hidden || lost;
    setLoop(sleeping ? "never" : "demand");
    if (!sleeping) refresh();
  };
  const lose = (event: Event) => {
    event.preventDefault();
    lost = true;
    onUnavailable(true);
    sync();
  };
  const restore = () => {
    lost = false;
    onUnavailable(false);
    sync();
  };
  canvas.addEventListener("webglcontextlost", lose);
  canvas.addEventListener("webglcontextrestored", restore);
  visibility.addEventListener("visibilitychange", sync);
  onUnavailable(lost);
  sync();
  return () => {
    canvas.removeEventListener("webglcontextlost", lose);
    canvas.removeEventListener("webglcontextrestored", restore);
    visibility.removeEventListener("visibilitychange", sync);
  };
}
