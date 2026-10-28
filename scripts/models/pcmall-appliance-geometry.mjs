import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Authored 3D surfaces only: no product photograph is used on a mesh. */
export function buildPcmallAppliance(item, sourceUrl) {
  const root = new THREE.Group();
  root.name = item.model;
  root.userData = { source: sourceUrl, representation: "dimensioned-planning-illustration", manufacturerCad: false,
    units: "meters", qualityRevision: 2, smoothNormals: true };
  const w = item.width / 1000, h = item.height / 1000, d = item.depth / 1000, front = d / 2;
  let section = "Enclosure";
  const material = (name, color, roughness, metalness = 0, more = {}) => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...more }); m.name = name; return m;
  };
  const paint = material("Factory enamel", item.color, .32, .05, { clearcoat: .28, clearcoatRoughness: .25 });
  const steel = material("Satin stainless steel", "#aeb3b9", .32, .82);
  const chrome = material("Polished edge metal", "#bec3c8", .19, .92);
  const black = material("Black glass border", "#101318", .18, .08, { clearcoat: .8, clearcoatRoughness: .12 });
  const rubber = material("Rubber and shadow reveals", "#15171a", .76);
  const enamel = material("Interior enamel", "#1c2229", .54, .1);
  const glass = material("Smoked transparent appliance glass", "#879aa5", .1, .03,
    { transparent: true, opacity: .24, depthWrite: false, clearcoat: 1, clearcoatRoughness: .08, side: THREE.DoubleSide });
  const dim = material("Printed control markings", "#79848a", .55, .1);
  const led = material("Dim display segments", "#de8d72", .5, 0, { emissive: "#dc4927", emissiveIntensity: .15 });
  const add = (name, geometry, at, finish, rotation) => {
    const mesh = new THREE.Mesh(geometry, finish); mesh.name = name;
    mesh.userData = { appliancePart: section, ...(finish === glass ? { applianceGlass: true } : {}) };
    mesh.position.set(...at); if (rotation) mesh.rotation.set(...rotation); root.add(mesh); return mesh;
  };
  const box = (name, size, at, finish, radius = .002) => add(name,
    radius ? new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(v => v / 2))) : new THREE.BoxGeometry(...size), at, finish);
  const disc = (name, radius, depth, at, finish, segments = 64) => add(name,
    new THREE.CylinderGeometry(radius, radius, depth, segments), at, finish, [Math.PI / 2, 0, 0]);
  const ring = (name, radius, thickness, at, finish, rotation = [0, 0, 0]) => add(name,
    new THREE.TorusGeometry(radius, thickness, 12, 96), at, finish, rotation);
  const rod = (name, a, b, radius, finish) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), length = start.distanceTo(end);
    const mesh = add(name, new THREE.CylinderGeometry(radius, radius, length, 12), start.clone().add(end).multiplyScalar(.5).toArray(), finish);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh;
  };
  const pane = (name, width, height, at, finish = glass) => add(name, new THREE.PlaneGeometry(width, height), at, finish);
  const display = (x, y, width, z = front - .026) => {
    box("Display recess", [width, .035, .003], [x, y, z], black, .002);
    const length = Math.min(.009, width / 12), thickness = length * .15;
    // 12:00, rendered from separate segment geometry rather than a face image.
    const glyphs = ["bc", "abdeg", "abcdef", "abcdef"];
    const bars = { a: [0, 1, 0], b: [.5, .5, 1], c: [.5, -.5, 1], d: [0, -1, 0], e: [-.5, -.5, 1], f: [-.5, .5, 1], g: [0, 0, 0] };
    glyphs.forEach((glyph, i) => {
      for (const s of glyph) {
        const [dx, dy, vertical] = bars[s];
        box("LED segment", vertical ? [thickness, length * .83, .0006] : [length * .83, thickness, .0006],
          [x + (i - 1.5) * length * 1.5 + dx * length, y + dy * length, z + .0018], led, 0);
      }
    });
    for (const dy of [-.0035, .0035]) box("Clock colon", [.0015, .0015, .0007], [x, y + dy, z + .002], led, 0);
  };
  const feet = () => { section = "Feet";
    for (const x of [-w * .4, w * .4]) for (const z of [-d * .37, d * .37])
      box("Adjustable foot", [.027, .02, .027], [x, .01, z], rubber, .004);
  };
  const shell = (bottom = 0, thickness = .012, bodyWidth = w) => {
    section = "Enclosure";
    const depth = d - .04, z = -.02;
    for (const side of [-1, 1]) box("Chassis side", [thickness, h - bottom, depth], [side * (bodyWidth - thickness) / 2, (h + bottom) / 2, z], paint, .004);
    box("Chassis top", [bodyWidth - 2 * thickness, thickness, depth], [0, h - thickness / 2, z], paint, .004);
    box("Chassis bottom", [bodyWidth - 2 * thickness, thickness, depth], [0, bottom + thickness / 2, z], paint, .003);
    box("Chassis back", [bodyWidth - 2 * thickness, h - bottom - 2 * thickness, thickness], [0, (h + bottom) / 2, -d / 2 + thickness / 2], enamel, .002);
  };
  const touchMarks = (count, y, z, spacing = .026) => {
    for (let i = 0; i < count; i++) ring("Control icon", .0022, .00045, [(i - (count - 1) / 2) * spacing, y, z], dim);
  };

  if (item.type === "oven") {
    shell(0, .012, Math.min(w, .56));
    section = "Oven cavity";
    const cavityWidth = w - .078, floor = .055, ceiling = h - .11, back = -d / 2 + .045;
    box("Cavity back", [cavityWidth, ceiling - floor, .008], [0, (floor + ceiling) / 2, back], enamel, .015);
    for (const side of [-1, 1]) box("Cavity side", [.009, ceiling - floor, d - .105], [side * cavityWidth / 2, (ceiling + floor) / 2, -.01], enamel, .003);
    for (const y of [floor, ceiling]) box("Cavity horizontal liner", [cavityWidth, .009, d - .105], [0, y, -.01], enamel, .003);
    section = "Oven convection fan";
    disc("Fan backing", .084, .003, [0, .265, back + .007], rubber);
    ring("Fan grille outer", .078, .002, [0, .265, back + .012], steel);
    ring("Fan grille inner", .048, .0014, [0, .265, back + .013], steel);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      rod("Fan grille spoke", [Math.cos(angle) * .02, .265 + Math.sin(angle) * .02, back + .012],
        [Math.cos(angle) * .075, .265 + Math.sin(angle) * .075, back + .012], .001, steel);
    }
    section = "Oven shelf rails";
    for (const side of [-1, 1]) {
      for (const z of [-.16, .11]) rod("Rack vertical support", [side * (cavityWidth / 2 - .009), .08, z], [side * (cavityWidth / 2 - .009), .44, z], .0021, chrome);
      for (let i = 0; i < 5; i++) rod("Shelf runner", [side * (cavityWidth / 2 - .009), .105 + i * .067, -.16], [side * (cavityWidth / 2 - .009), .105 + i * .067, .16], .0024, chrome);
    }
    section = "Oven wire rack";
    const rackWidth = cavityWidth - .035, rackFront = .172, rackBack = -.165, rackY = .348;
    for (const z of [rackFront, rackBack]) rod("Rack frame", [-rackWidth / 2, rackY, z], [rackWidth / 2, rackY, z], .0022, chrome);
    for (const x of [-rackWidth / 2, rackWidth / 2]) rod("Rack frame", [x, rackY, rackBack], [x, rackY, rackFront], .0022, chrome);
    for (let x = -rackWidth / 2 + .014; x < rackWidth / 2; x += .022) rod("Wire rack bar", [x, rackY, rackBack], [x, rackY, rackFront], .00155, chrome);
    section = "Oven baking trays";
    for (const y of [.119, .223]) {
      box("Tray base", [rackWidth - .009, .006, .331], [0, y, .003], enamel, .005);
      for (const side of [-1, 1]) {
        box("Tray side lip", [.008, .016, .331], [side * (rackWidth - .017) / 2, y + .007, .003], enamel, .003);
        box("Tray front back lip", [rackWidth - .015, .016, .008], [0, y + .007, .003 + side * .1615], enamel, .003);
      }
    }
    section = "Oven control fascia";
    box("Inox control fascia", [w, .089, .025], [0, h - .0445, front - .028], steel, .002);
    box("Black touch panel", [.246, .084, .003], [0, h - .042, front - .014], black, .002);
    display(0, h - .027, .112, front - .011);
    touchMarks(7, h - .062, front - .009, .025);
    section = "Oven door frame";
    const frameZ = front - .031, frameTop = h - .097, frameBottom = .058, windowBottom = .071, windowTop = .407, windowWidth = w - .105;
    box("Door bottom inox rail", [w - .008, .052, .022], [0, .032, frameZ], steel, .002);
    box("Door upper black rail", [w - .008, frameTop - windowTop, .022], [0, (frameTop + windowTop) / 2, frameZ], black, .002);
    for (const side of [-1, 1]) box("Door black side rail", [(w - .008 - windowWidth) / 2, windowTop - frameBottom, .022],
      [side * (windowWidth / 2 + (w - .008 - windowWidth) / 4), (windowTop + frameBottom) / 2, frameZ], black, .002);
    box("Door lower black reveal", [windowWidth, windowBottom - frameBottom, .022], [0, (frameBottom + windowBottom) / 2, frameZ], black, .001);
    section = "Oven door glass";
    pane("Smoked glass viewing window", windowWidth, windowTop - windowBottom, [0, (windowTop + windowBottom) / 2, front - .018]);
    section = "Oven handle";
    const handleY = .449;
    for (const x of [-w * .36, w * .36]) box("Handle standoff", [.017, .02, .027], [x, handleY, front - .024], rubber, .003);
    box("Solid satin handle", [w * .86, .02, .016], [0, handleY, front - .008], steel, .003);
    section = "Oven vent";
    for (let i = 0; i < 24; i++) box("Vent slot", [.012, .0025, .001], [(i - 11.5) * .019, .498, front - .013], rubber, 0);
    root.userData.qualityFeatures = ["hollow-cavity", "transparent-glass", "wire-rack", "baking-trays", "convection-fan", "satin-metal"];
  } else if (item.type === "washing-machine") {
    shell(.02); feet();
    section = "Washer front";
    const y = h * .45, radius = .175, thickness = .018;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + .006, .024); shape.lineTo(w / 2 - .006, .024); shape.lineTo(w / 2 - .006, h - .105);
    shape.lineTo(-w / 2 + .006, h - .105); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, y, radius, 0, Math.PI * 2, true); shape.holes.push(hole);
    add("Front panel with round aperture", new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .001, bevelThickness: .001, curveSegments: 64 }), [0, 0, front - .034], paint);
    box("Control fascia", [w - .008, .103, .025], [0, h - .0565, front - .026], paint, .004);
    box("Detergent drawer shadow", [w * .285, .052, .002], [-w * .32, h - .063, front - .012], rubber, .002);
    box("Detergent drawer", [w * .28, .048, .003], [-w * .32, h - .062, front - .01], paint, .002);
    box("Drawer finger recess", [.085, .008, .002], [-w * .32, h - .049, front - .008], dim, .001);
    section = "Washer controls";
    disc("Selector bezel", .028, .008, [-.006, h - .058, front - .012], chrome, 96);
    disc("Selector face", .023, .012, [-.006, h - .058, front - .008], black, 96);
    box("Selector index", [.0015, .007, .0008], [-.006, h - .041, front - .001], dim, 0);
    display(w * .27, h - .055, .115, front - .011);
    touchMarks(5, h - .086, front - .008, .036);
    section = "Washer door gasket";
    ring("Door outer rim", .181, .012, [0, y, front - .016], black);
    ring("Inner metal rim", .164, .006, [0, y, front - .013], chrome);
    ring("Rubber seal", .152, .011, [0, y, front - .033], rubber);
    section = "Washer stainless drum";
    const drumMaterial = steel.clone(); drumMaterial.name = "Brushed drum steel"; drumMaterial.side = THREE.DoubleSide;
    add("Open drum barrel", new THREE.CylinderGeometry(.145, .145, .24, 96, 1, true), [0, y, front - .162], drumMaterial, [Math.PI / 2, 0, 0]);
    disc("Drum rear", .143, .004, [0, y, front - .281], steel, 96);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const paddle = box("Drum lifting paddle", [.025, .014, .19], [Math.cos(angle) * .127, y + Math.sin(angle) * .127, front - .155], steel, .006);
      paddle.rotation.z = angle - Math.PI / 2;
    }
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI * 2 / 48;
      disc("Drum rear perforation", .0017, .0008, [.108 * Math.cos(angle), y + .108 * Math.sin(angle), front - .278], rubber, 8);
    }
    section = "Washer door glass";
    const bowl = add("Curved smoked door glass", new THREE.SphereGeometry(.148, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), [0, y, front - .035], glass, [Math.PI / 2, 0, 0]);
    bowl.scale.y = .18;
    section = "Washer service hatch";
    box("Service hatch gap", [.093, .069, .002], [w * .32, .083, front - .013], dim, .005);
    box("Service hatch", [.089, .065, .003], [w * .32, .083, front - .011], paint, .005);
    root.userData.qualityFeatures = ["round-front-aperture", "transparent-glass", "stainless-drum", "curved-gasket", "satin-metal"];
  } else if (item.type === "microwave") {
    shell(.014, .009); feet();
    section = "Microwave cavity";
    const inside = material("Microwave ceramic interior", "#657079", .55, .1);
    box("Cavity back", [w * .73, h * .72, .006], [-w * .075, h * .48, -d / 2 + .026], inside);
    box("Cavity floor", [w * .73, .005, d * .79], [-w * .075, .045, -.008], inside);
    const plate = disc("Turntable", .125, .004, [-w * .075, .051, -.018], dim);
    plate.rotation.x = 0;
    section = "Microwave door frame";
    const faceZ = front - .012, glassW = w * .66, glassH = h * .63, glassX = -w * .12, glassY = h * .51;
    box("Top door rail", [w - .006, .034, .022], [0, h - .029, faceZ], black, .003);
    box("Bottom door rail", [w - .006, .033, .022], [0, .035, faceZ], black, .003);
    box("Left door rail", [.021, h - .08, .022], [-w / 2 + .013, h / 2, faceZ], black, .003);
    box("Door handle", [.018, glassH * .8, .018], [w * .24, glassY, front - .009], black, .004);
    section = "Microwave door glass";
    pane("Smoked microwave glass", glassW, glassH, [glassX, glassY, front - .005]);
    section = "Microwave mesh screen";
    const screenMaterial = material("Fine microwave mesh", "#333d45", .65, .2);
    for (let i = 0; i < 33; i++) rod("Screen vertical wire", [glassX - glassW / 2 + i * glassW / 32, glassY - glassH / 2, front - .012], [glassX - glassW / 2 + i * glassW / 32, glassY + glassH / 2, front - .012], .00025, screenMaterial);
    for (let i = 0; i < 18; i++) rod("Screen horizontal wire", [glassX - glassW / 2, glassY - glassH / 2 + i * glassH / 17, front - .012], [glassX + glassW / 2, glassY - glassH / 2 + i * glassH / 17, front - .012], .00025, screenMaterial);
    section = "Microwave controls";
    box("Control fascia", [w * .2, h - .06, .023], [w * .384, h / 2, faceZ], black, .003);
    display(w * .383, h * .77, w * .17, front - .005);
    for (let i = 0; i < 5; i++) for (const side of [-1, 1]) box("Touch key", [.023, .007, .0008], [w * .384 + side * .023, h * .6 - i * .023, front - .0008], dim, 0);
    root.userData.qualityFeatures = ["hollow-cavity", "transparent-glass", "turntable", "door-mesh"];
  } else if (item.type === "cooktop") {
    section = "Cooktop inset housing";
    box("Recessed lower housing", [w * .94, h - .007, d * .94], [0, (h - .007) / 2, 0], rubber, .004);
    section = "Cooktop ceramic glass";
    const ceramic = material("Polished black ceramic", "#11151a", .105, .08, { clearcoat: 1, clearcoatRoughness: .08 });
    box("Bevelled ceramic glass", [w, .006, d], [0, h - .003, 0], ceramic, .0018);
    section = "Cooktop printed zones";
    for (const [x, z, r] of [[-.15, -.12, .078], [.15, -.12, .068], [-.15, .1, .067], [.15, .1, .091]]) {
      ring("Cooking zone outline", r, .00035, [x, h - .0004, z], dim, [Math.PI / 2, 0, 0]);
      ring("Inner heating zone", r * .77, .00022, [x, h - .0003, z], dim, [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 10; i++) box("Touch slider marking", [.002, .0003, .006], [(i - 4.5) * .013, h - .00015, d * .405], dim, 0);
    root.userData.qualityFeatures = ["bevelled-glass", "clearcoat", "fine-control-markings"];
  } else if (item.type === "hood") {
    section = "Hood enclosure";
    box("Hood top", [w, .012, d], [0, h - .006, 0], steel, .004);
    for (const side of [-1, 1]) box("Hood side", [.009, h - .012, d], [side * (w - .009) / 2, (h - .012) / 2, 0], steel, .003);
    box("Hood back", [w - .018, h - .012, .009], [0, (h - .012) / 2, -d / 2 + .0045], steel);
    box("Front satin lip", [w - .018, .043, .012], [0, .025, front - .006], steel, .004);
    section = "Hood control strip";
    box("Slider recess", [.166, .015, .002], [-w * .26, .027, front - .0008], rubber, .002);
    for (let i = 0; i < 4; i++) box("Slider key", [.016, .007, .003], [-w * .34 + i * .028, .028, front], black, .001);
    section = "Hood filter grille";
    const filterW = w * .78, filterD = d * .69;
    for (const side of [-1, 1]) {
      box("Filter edge", [filterW, .007, .007], [0, .006, side * filterD / 2], chrome, .001);
      box("Filter edge", [.007, .007, filterD], [side * filterW / 2, .006, 0], chrome, .001);
    }
    for (let i = 0; i < 33; i++) rod("Filter wire", [-filterW / 2 + i * filterW / 32, .004, -filterD / 2], [-filterW / 2 + i * filterW / 32, .004, filterD / 2], .0006, steel);
    for (let i = 0; i < 23; i++) rod("Filter wire", [-filterW / 2, .004, -filterD / 2 + i * filterD / 22], [filterW / 2, .004, -filterD / 2 + i * filterD / 22], .0006, steel);
    root.userData.qualityFeatures = ["open-filter", "wire-grille", "satin-metal"];
  } else if (item.type === "fridge") {
    box("Refrigerator chassis", [w, h - .022, d - .035], [0, (h + .022) / 2, -.0175], paint, .007);
    section = "Refrigerator door";
    box("Door gasket reveal", [w - .006, h - .027, .007], [0, h / 2 + .003, front - .028], rubber, .003);
    box("Bespoke enamel door", [w - .008, h - .032, .028], [0, h / 2 + .004, front - .014], paint, .006);
    section = "Refrigerator pocket grip";
    box("Recessed door grip", [.01, h * .41, .009], [-w / 2 + .014, h * .47, front - .0045], rubber, .002);
    section = "Refrigerator toe grille";
    box("Toe recess", [w - .03, .018, .026], [0, .009, front - .026], rubber, .002);
    for (let i = 0; i < 23; i++) box("Toe grille slot", [.01, .003, .001], [(i - 11) * .021, .012, front - .011], dim, 0);
    root.userData.qualityFeatures = ["soft-enamel-edges", "door-gasket", "pocket-grip"];
  } else {
    shell(.02); feet();
    section = "Dishwasher front";
    box("Door gasket gap", [w - .008, h - .038, .008], [0, h / 2 + .006, front - .025], rubber, .002);
    box("Integrated front panel", [w - .012, h - .043, .025], [0, h / 2 + .006, front - .0125], paint, .004);
    box("Finger pocket", [w * .43, .013, .003], [0, h - .051, front - .0015], rubber, .003);
    section = "Dishwasher top controls";
    box("Top stainless control rail", [w - .02, .011, .024], [0, h - .0055, front - .014], steel, .002);
    for (let i = 0; i < 7; i++) box("Program selector", [.009, .0005, .008], [-w * .29 + i * .052, h - .00025, front - .015], dim, 0);
    section = "Dishwasher toe recess";
    box("Toe shadow", [w - .045, .05, .014], [0, .048, front - .014], rubber, .003);
    root.userData.qualityFeatures = ["panel-gaps", "top-controls", "satin-metal"];
  }

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
  const normalise = new THREE.Matrix4().makeScale(w / size.x, h / size.y, d / size.z)
    .multiply(new THREE.Matrix4().makeTranslation(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2));
  const batches = new Map();
  for (const mesh of [...root.children]) {
    mesh.updateMatrix();
    // applyMatrix4 transforms the authored smooth normals with the normal matrix.
    // computeVertexNormals on RoundedBox's non-indexed triangles would facet it.
    mesh.geometry.applyMatrix4(normalise.clone().multiply(mesh.matrix));
    const key = `${mesh.userData.appliancePart}:${mesh.material.uuid}`;
    const batch = batches.get(key) ?? { name: mesh.userData.appliancePart, material: mesh.material, geometries: [], userData: mesh.userData };
    batch.geometries.push(mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry);
    batches.set(key, batch); root.remove(mesh);
  }
  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geometries, false);
    const geometry = mergeVertices(merged, 1e-6); merged.dispose();
    geometry.normalizeNormals();
    for (const original of batch.geometries) original.dispose();
    const mesh = new THREE.Mesh(geometry, batch.material); mesh.name = batch.name;
    mesh.userData = batch.userData; mesh.castShadow = !batch.userData.applianceGlass; mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
