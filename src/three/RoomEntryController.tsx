"use client";
import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomInteriorCamera } from "@/lib/types";
import {
  applyCameraPose,
  cameraPose,
  cancelCameraTransition,
  type CameraPose,
} from "@/lib/cameraTransition";
import type { NavigationControls } from "@/lib/plannerCamera";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";
import {
  ROOM_ENTRY,
  advanceEntry,
  cameraEntryPose,
  entrySettled,
  entryTargetOverRoom,
  entryYaw,
  exteriorOverview,
  feedEntry,
  interiorEntryPose,
  roomEntryDistance,
  wheelPixels,
  writeEntryPose,
  type EntryPose,
  type EntryProgress,
} from "@/lib/roomEntryTransition";
import type { InteriorEntryChannel } from "./roomEntryChannel";

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type RoomEntryTransition = "entering" | "exiting" | null;
/** The orbit pose a scroll entry started from, in that moment's room coordinates. */
export type ExteriorMemory = { roomId: string; originX: number; originZ: number; pose: CameraPose };

type Run = {
  kind: "entering" | "exiting";
  state: EntryProgress;
  /** progress 0 */
  exterior: EntryPose;
  /** progress 1 */
  interior: EntryPose;
  exteriorPose: CameraPose;
  interiorPose: RoomInteriorCamera;
  controls?: { enabled: boolean };
  controlsEnabled?: boolean;
  committed: boolean;
  idle: boolean;
};

const orientation = (position: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, target, up));
const reducedMotion = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll-in walks the orbit camera into the active room; scroll-out at the
 * widest interior view walks it back out. Progress follows the wheel, so a
 * direction change mid-way reverses from the displayed pose. While a run is
 * active this component is the only camera writer: orbit controls are
 * disabled and the interior controller is suspended through the channel.
 */
export function RoomEntryController({
  interior,
  enabled,
  roomId,
  pose,
  bounds,
  height,
  originX,
  originZ,
  channel,
  memory,
  abortKey,
  onTransition,
  onEnter,
  onExit,
}: {
  interior: boolean;
  enabled: boolean;
  roomId: string;
  /** The active room's validated interior viewpoint. */
  pose: RoomInteriorCamera;
  bounds: Bounds;
  height: number;
  originX: number;
  originZ: number;
  channel: InteriorEntryChannel;
  memory: MutableRefObject<ExteriorMemory | null>;
  /** An explicit camera request abandons an unfinished run. */
  abortKey?: unknown;
  onTransition: (transition: RoomEntryTransition) => void;
  onEnter?: (pose: RoomInteriorCamera) => void;
  onExit?: (pose: CameraPose) => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const controls = useThree((state) => state.controls);
  const connected = useThree((state) => state.events.connected) as HTMLElement | undefined;
  const size = useThree((state) => state.size);
  const run = useRef<Run | null>(null);
  const cooldown = useRef({ until: 0, sign: 0 });
  const live = useRef({ interior, enabled, roomId, pose, bounds, height, originX, originZ, controls, size, onTransition, onEnter, onExit });
  live.current = { interior, enabled, roomId, pose, bounds, height, originX, originZ, controls, size, onTransition, onEnter, onExit };
  const perspective = camera as THREE.PerspectiveCamera;

  const release = () => {
    const active = run.current;
    if (!active) return;
    run.current = null;
    if (active.kind === "entering") {
      const orbit = live.current.controls as unknown as NavigationControls | undefined;
      applyCameraPose(perspective, active.exteriorPose, orbit && "target" in orbit ? orbit : undefined);
      if (active.controls) active.controls.enabled = active.controlsEnabled ?? true;
    } else {
      channel.suspended = false;
      channel.resume();
    }
    live.current.onTransition(null);
    invalidate();
  };

  // A committed run ends once the planner has switched mode under it.
  useLayoutEffect(() => {
    const active = run.current;
    if (!active) return;
    if (active.committed && (active.kind === "entering") === interior) {
      run.current = null;
      if (active.kind === "exiting") channel.suspended = false;
      live.current.onTransition(null);
    } else if (!active.committed) release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interior]);
  useLayoutEffect(() => {
    if (run.current && !run.current.committed) release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, abortKey]);
  useEffect(() => () => {
    if (run.current?.kind === "exiting") channel.suspended = false;
    run.current = null;
  }, [channel]);

  useEffect(() => {
    const root = connected ?? gl.domElement;
    const view = root.ownerDocument?.defaultView;
    if (!view) return;
    const inside = (event: Event) => !!event.target && root.contains(event.target as Node);
    const consume = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const aspect = () => live.current.size.width / Math.max(1, live.current.size.height);
    const beginEntry = (pixels: number) => {
      const props = live.current;
      const orbit = props.controls as unknown as (NavigationControls & { enabled: boolean }) | undefined;
      if (pixels >= 0 || !props.onEnter || !orbit || !("target" in orbit) || !orbit.enabled) return false;
      if (perspective.position.distanceTo(orbit.target) > roomEntryDistance(props.bounds) ||
        !entryTargetOverRoom(orbit.target, props.bounds)) return false;
      cancelCameraTransition(perspective);
      const exteriorPose = cameraPose(perspective, orbit.target);
      const interiorPose = { ...props.pose, yaw: entryYaw(perspective.position, orbit.target, props.pose.yaw), pitch: ROOM_ENTRY.entryPitch };
      run.current = {
        kind: "entering", state: { progress: 0, target: 0 }, exterior: cameraEntryPose(perspective),
        interior: interiorEntryPose(interiorPose, aspect()), exteriorPose, interiorPose,
        controls: orbit, controlsEnabled: orbit.enabled, committed: false, idle: true,
      };
      orbit.enabled = false;
      props.onTransition("entering");
      return true;
    };
    const beginExit = (pixels: number) => {
      const props = live.current;
      if (pixels <= 0 || !props.onExit || !channel.atWidestView()) return false;
      channel.hold();
      channel.suspended = true;
      const saved = memory.current;
      let exteriorPose: CameraPose;
      if (saved && saved.roomId === props.roomId) {
        const shift = new THREE.Vector3(saved.originX - props.originX, 0, saved.originZ - props.originZ);
        exteriorPose = { ...saved.pose, position: saved.pose.position.clone().add(shift), target: saved.pose.target.clone().add(shift), up: saved.pose.up.clone() };
      } else {
        const yaw = new THREE.Euler().setFromQuaternion(perspective.quaternion, "YXZ").y;
        exteriorPose = exteriorOverview(props.bounds, props.height, yaw, PLANNER_CAMERA.fov, aspect());
      }
      run.current = {
        kind: "exiting", state: { progress: 1, target: 1 },
        exterior: { position: exteriorPose.position.clone(), quaternion: orientation(exteriorPose.position, exteriorPose.target, exteriorPose.up), fov: exteriorPose.fov },
        interior: cameraEntryPose(perspective), exteriorPose, interiorPose: props.pose, committed: false, idle: true,
      };
      props.onTransition("exiting");
      return true;
    };
    const wheel = (event: WheelEvent) => {
      if (!inside(event) || !event.deltaY) return;
      const pixels = wheelPixels(event, root.clientHeight);
      const active = run.current;
      if (active?.committed) return consume(event); // The mode switch is pending.
      if (!active) {
        if (!live.current.enabled || Math.abs(pixels) < ROOM_ENTRY.deadZone) return;
        // Inertia continuing past a commit must not bounce straight back.
        if (performance.now() < cooldown.current.until && Math.sign(pixels) === cooldown.current.sign) return consume(event);
        if (!(live.current.interior ? beginExit(pixels) : beginEntry(pixels))) return;
      }
      consume(event);
      if (Math.abs(pixels) < ROOM_ENTRY.deadZone || !run.current) return;
      run.current.state = feedEntry(run.current.state, pixels);
      invalidate();
    };
    const press = (event: PointerEvent) => {
      const active = run.current;
      if (!active || !inside(event)) return;
      consume(event);
      if (active.committed) return;
      // Pressing mid-way settles at the nearer end instead of leaving a half pose.
      active.state = { ...active.state, target: active.state.progress >= 0.5 ? 1 : 0 };
      invalidate();
    };
    view.addEventListener("wheel", wheel, { capture: true, passive: false });
    view.addEventListener("pointerdown", press, true);
    return () => {
      view.removeEventListener("wheel", wheel, true);
      view.removeEventListener("pointerdown", press, true);
    };
  }, [gl, connected, perspective, channel, memory, invalidate]);

  useFrame((_, delta) => {
    const active = run.current;
    if (!active || active.committed) return;
    // After a settled pause R3F's delta includes idle time; it is not motion time.
    const step = active.idle ? Math.min(delta, 1 / 60) : delta;
    active.idle = false;
    active.state = advanceEntry(active.state, step, reducedMotion());
    writeEntryPose(perspective, active.exterior, active.interior, active.state.progress);
    if (!entrySettled(active.state)) {
      invalidate();
      return;
    }
    active.idle = true;
    const { progress } = active.state;
    if (progress === 0 && active.kind === "entering") release();
    else if (progress === 1 && active.kind === "exiting") release();
    else if (progress === 1) {
      active.committed = true;
      cooldown.current = { until: performance.now() + ROOM_ENTRY.reversalCooldownMs, sign: 1 };
      const { roomId, originX, originZ } = live.current;
      memory.current = { roomId, originX, originZ, pose: active.exteriorPose };
      live.current.onEnter?.(active.interiorPose);
    } else if (progress === 0) {
      active.committed = true;
      cooldown.current = { until: performance.now() + ROOM_ENTRY.reversalCooldownMs, sign: -1 };
      perspective.far = Math.max(perspective.far, active.exteriorPose.far);
      perspective.updateProjectionMatrix();
      memory.current = null;
      live.current.onExit?.(active.exteriorPose);
    }
  });
  return null;
}
