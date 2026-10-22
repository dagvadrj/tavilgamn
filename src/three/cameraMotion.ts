// Only interaction edges update React; frequent damping changes reset this timer.
export function createCameraMotion(setMoving: (moving: boolean) => void, delay = 250) {
  let moving = false;
  let dragging = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const settle = () => {
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      if (moving) { moving = false; setMoving(false); }
    }, delay);
  };
  const preview = () => {
    if (!moving) { moving = true; setMoving(true); }
    settle();
  };
  return {
    start() {
      dragging = true;
    },
    change(autoRotate = false) {
      // Idle auto-rotation is not a user gesture. Do not stay on preview forever.
      if (dragging || (moving && !autoRotate)) {
        preview();
      }
    },
    // Camera poses also change through interior navigation and view transitions,
    // where there may be no OrbitControls gesture to emit start/change/end.
    observe(autoRotate = false) {
      if (!autoRotate || dragging) preview();
    },
    end() { dragging = false; if (moving) settle(); },
    cancel() {
      clear(); dragging = false;
      if (moving) { moving = false; setMoving(false); }
    },
    dispose() { clear(); },
  };
}
