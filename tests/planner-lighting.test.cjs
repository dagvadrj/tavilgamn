const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const { plannerLighting, plannerEnvironmentIntensity } = loadSource(
  "src/lib/plannerLighting.ts",
);

test("shared planner fill preserves sunlight and ambient slider ranges through day and night", () => {
  const lighting = { timeOfDay: 12, ambient: 0.65, sunlight: 1.8 };
  const day = plannerLighting(lighting);
  assert.ok(Math.abs(day.ambientIntensity - 0.26) < 1e-10);
  assert.ok(Math.abs(day.hemisphereIntensity - 0.34) < 1e-10);
  assert.equal(day.sunlightIntensity, 1.8);
  assert.equal(day.environmentIntensity, 0.75);
  const doubled = plannerLighting({ ...lighting, ambient: 1.3, sunlight: 3.6 });
  assert.equal(doubled.ambientIntensity, day.ambientIntensity * 2);
  assert.equal(doubled.sunlightIntensity, day.sunlightIntensity * 2);
  const off = plannerLighting({ ...lighting, ambient: 0, sunlight: 0 });
  assert.equal(off.ambientIntensity, 0);
  assert.equal(off.sunlightIntensity, 0);
  const night = plannerLighting({ ...lighting, timeOfDay: 22 });
  assert.equal(night.sunlightIntensity, 0);
  assert.equal(night.environmentIntensity, 0.08);
  assert.ok(night.ambientIntensity < day.ambientIntensity);
  assert.ok(night.hemisphereIntensity < day.hemisphereIntensity);
  assert.equal(night.solar.lampsOn, true);
  assert.equal(
    plannerLighting({ ...lighting, autoLights: false }).solar.lampsOn,
    true,
  );
  assert.deepEqual(lighting, { timeOfDay: 12, ambient: 0.65, sunlight: 1.8 });
});

test("malformed saved lighting cannot produce negative or nonfinite shader intensities", () => {
  for (const ambient of [NaN, Infinity, -1]) {
    const rig = plannerLighting({ ambient, sunlight: ambient, timeOfDay: 12 });
    for (const value of [
      rig.ambientIntensity,
      rig.sunlightIntensity,
      rig.environmentIntensity,
    ]) {
      assert.ok(Number.isFinite(value) && value >= 0);
    }
  }
  assert.equal(plannerEnvironmentIntensity(-1), 0.08);
  assert.equal(plannerEnvironmentIntensity(10), 0.75);
  assert.equal(plannerEnvironmentIntensity(NaN), 0.75);
});

test("renderer colour settings preserve the mobile shadow budget and transparent capture state", () => {
  const { configurePlannerRenderer } = loadSource(
    "src/three/plannerRenderer.ts",
  );
  const gl = {
    shadowMap: {
      enabled: false,
      type: THREE.BasicShadowMap,
      needsUpdate: false,
    },
    alpha: true,
    clearAlpha: 0,
    pixelRatio: 1,
    toneMappingExposure: 3,
  };
  configurePlannerRenderer(gl);
  assert.equal(gl.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(gl.outputColorSpace, THREE.SRGBColorSpace);
  assert.equal(gl.toneMappingExposure, 1);
  assert.equal(gl.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.equal(gl.shadowMap.needsUpdate, true);
  assert.equal(gl.shadowMap.enabled, false);
  assert.equal(gl.alpha, true);
  assert.equal(gl.clearAlpha, 0);
  assert.equal(gl.pixelRatio, 1);
  gl.shadowMap.needsUpdate = false;
  configurePlannerRenderer(gl);
  assert.equal(gl.shadowMap.needsUpdate, false);
});

test("daylight only adjusts environment strength while the one-shot IBL capture children remain stable", () => {
  const scene = new THREE.Scene();
  scene.environmentIntensity = 0.9;
  let invalidations = 0;
  const invalidate = () => invalidations++;
  let cleanup;
  const { PlannerEnvironment } = loadSource(
    "src/three/PlannerEnvironment.tsx",
    {
      react: {
        ...React,
        useLayoutEffect: (effect) => {
          cleanup?.();
          cleanup = effect();
        },
      },
      "@react-three/fiber": {
        useThree: (select) => select({ scene, invalidate }),
      },
      "@react-three/drei": {
        Environment: "environment",
        Lightformer: "lightformer",
      },
    },
  );
  assert.equal(PlannerEnvironment.$$typeof, Symbol.for("react.memo"));
  const day = PlannerEnvironment.type({ daylight: 1 });
  assert.equal(scene.environmentIntensity, 0.75);
  const night = PlannerEnvironment.type({ daylight: 0 });
  assert.equal(scene.environmentIntensity, 0.08);
  assert.equal(
    day.props.children,
    night.props.children,
    "Drei's capture dependencies must remain unchanged",
  );
  assert.equal(day.props.frames, 1);
  assert.equal(day.props.resolution, 256);
  assert.equal(day.props.files, undefined);
  assert.equal(day.props.preset, undefined);
  assert.equal(
    day.props.background,
    undefined,
    "the planner retains its own backdrop",
  );
  const panels = day.props.children.props.children.filter(
    (node) => node.type === "lightformer",
  );
  assert.equal(panels.length, 3);
  assert.ok(
    panels.every(
      (node) => node.props.form === "rect" && node.props.color === "#ffffff",
    ),
  );
  assert.equal(invalidations, 2);
  cleanup();
  assert.equal(scene.environmentIntensity, 0.9);
});
