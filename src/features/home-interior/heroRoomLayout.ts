export const HERO_ROOM = { width: 8.4, depth: 6.4, height: 3.6, backZ: -3.3 } as const;
export const HERO_WINDOW = { x: -2.65, width: 2.1, bottom: .9, top: 3.2 } as const;
export const HERO_SUN = {
  position: [-4.3, 4.8, -7] as [number, number, number],
  target: [.3, 0, 2] as [number, number, number],
};
export const HERO_MEDIA_WALL = { x: 1.4, width: 4.5, height: 3.2, y: 1.72, z: -3.13, slatPitch: .072, slatWidth: .045 } as const;

/** Four opaque wall sections leave a real aperture for the window light. */
export function heroBackWallSections() {
  const left = -HERO_ROOM.width / 2, right = -left;
  const windowLeft = HERO_WINDOW.x - HERO_WINDOW.width / 2;
  const windowRight = HERO_WINDOW.x + HERO_WINDOW.width / 2;
  return [
    { x: (left + windowLeft) / 2, y: HERO_ROOM.height / 2, width: windowLeft - left, height: HERO_ROOM.height },
    { x: (windowRight + right) / 2, y: HERO_ROOM.height / 2, width: right - windowRight, height: HERO_ROOM.height },
    { x: HERO_WINDOW.x, y: HERO_WINDOW.bottom / 2, width: HERO_WINDOW.width, height: HERO_WINDOW.bottom },
    { x: HERO_WINDOW.x, y: (HERO_WINDOW.top + HERO_ROOM.height) / 2, width: HERO_WINDOW.width, height: HERO_ROOM.height - HERO_WINDOW.top },
  ];
}

export function heroSlatPositions() {
  const wall = HERO_MEDIA_WALL, count = Math.floor(wall.width / wall.slatPitch);
  return Array.from({ length: count }, (_, index) => wall.x + (index - (count - 1) / 2) * wall.slatPitch);
}
