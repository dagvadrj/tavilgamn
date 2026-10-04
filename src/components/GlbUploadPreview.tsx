"use client";

import { useEffect, useRef, useState } from "react";
import { Box3, Vector3, Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, AxesHelper, GridHelper, Mesh, Texture } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createModelLoader } from "@/three/modelLoader";
import { GLB_STANDARD, inspectGlb, validateCabinetGlb, type GlbDimensions, type GlbInspection } from "@/lib/glbStandard";

export type GlbPreviewResult = { file: File; report: GlbInspection; thumbnail: File; frontConfirmed: boolean };
export default function GlbUploadPreview({ file, expected, onChange, allowFrontProjection = false }: {
  file: File | null; expected: GlbDimensions; onChange: (value: GlbPreviewResult | null) => void; allowFrontProjection?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange); callback.current = onChange;
  const [result, setResult] = useState<Omit<GlbPreviewResult, "frontConfirmed"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [frontProjectionMm, setFrontProjectionMm] = useState(0);
  useEffect(() => {
    setResult(null); setConfirmed(false); setError(null); callback.current(null);
    if (!file || !host.current) return;
    let cancelled = false, cleanup = () => {};
    const container = host.current;
    void (async () => {
      const bytes = await file.arrayBuffer(), report = inspectGlb(bytes);
      if (cancelled) return;
      const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(512, 384);
      renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "auto";
      container.appendChild(renderer.domElement);
      const { loader, draco, ktx } = createModelLoader(renderer);
      const scene = new Scene(); scene.background = new Color("#f3f4f1");
      const camera = new PerspectiveCamera(40, 512 / 384, 0.001, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      scene.add(new HemisphereLight(0xffffff, 0x777766, 3));
      const light = new DirectionalLight(0xffffff, 3); light.position.set(2, 3, 4); scene.add(light);
      const resources = new Set<{ dispose(): void }>();
      cleanup = () => {
        controls.dispose(); draco.dispose(); ktx.dispose();
        scene.traverse(object => {
          if (!(object instanceof Mesh)) return;
          resources.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            resources.add(material);
            for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
          }
        });
        resources.forEach(value => value.dispose()); renderer.dispose(); renderer.domElement.remove();
      };
      const asset = await loader.parseAsync(bytes, "");
      if (cancelled) {
        scene.add(asset.scene); cleanup(); return;
      }
      scene.add(asset.scene);
      // Do not rescale/recenter: the preview exposes incorrect origin and orientation.
      const bounds = new Box3().setFromObject(asset.scene), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
      const radius = Math.max(size.x, size.y, size.z);
      camera.position.copy(center).add(new Vector3(1, 0.65, 1.8).multiplyScalar(radius));
      controls.target.copy(center); controls.update();
      renderer.render(scene, camera);
      const thumbnail = await new Promise<Blob>((resolve, reject) => renderer.domElement.toBlob(blob => blob ? resolve(blob) : reject(new Error("Thumbnail үүссэнгүй.")), "image/png"));
      if (cancelled) return;
      const axes = new AxesHelper(radius); scene.add(axes); resources.add(axes.geometry);
      for (const material of Array.isArray(axes.material) ? axes.material : [axes.material]) resources.add(material);
      const grid = new GridHelper(radius * 3, 12); scene.add(grid); resources.add(grid.geometry);
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) resources.add(material);
      const render = () => renderer.render(scene, camera);
      controls.addEventListener("change", render); render();
      // Use decoded geometry in the browser, not compressed accessor metadata.
      const decodedReport = { ...report, min: bounds.min.toArray(), max: bounds.max.toArray(),
        dimensions: { widthMm: size.x * 1000, heightMm: size.y * 1000, depthMm: size.z * 1000 },
        bottomCentered: Math.max(Math.abs(center.x), Math.abs(bounds.min.y), Math.abs(center.z)) <= GLB_STANDARD.originToleranceMm / 1000 };
      setResult({ file, report: decodedReport, thumbnail: new File([thumbnail], "glb-thumbnail.png", { type: "image/png" }) });
    })().catch(reason => { if (!cancelled) { cleanup(); setError(reason instanceof Error ? reason.message : "Preview ачаалсангүй."); } });
    return () => { cancelled = true; cleanup(); };
  }, [file]);
  const validResult = result?.file === file ? result : null;
  useEffect(() => { setConfirmed(false); }, [expected.widthMm, expected.heightMm, expected.depthMm, frontProjectionMm, allowFrontProjection]);
  const projection = allowFrontProjection ? frontProjectionMm : 0;
  const issues = validResult ? validateCabinetGlb({ ...validResult.report, frontProjectionMm: projection }, expected) : [];
  const valid = Boolean(validResult && !issues.length);
  useEffect(() => {
    callback.current(validResult && valid && confirmed ? { ...validResult, report: { ...validResult.report, frontProjectionMm: projection }, frontConfirmed: true } : null);
  }, [validResult, valid, confirmed, projection]);
  if (!file) return null;
  return <section className="space-y-2 rounded-xl border border-black/10 p-3 md:col-span-2 xl:col-span-4" aria-label="GLB upload preview">
    <p className="text-sm font-medium">Upload-аас өмнөх GLB шалгалт</p>
    <div ref={host} className="max-w-lg" />
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!validResult && !error && <p role="status">GLB шалгаж байна…</p>}
    {validResult && <>
      <p className="text-xs">{Math.round(validResult.report.dimensions.widthMm)}×{Math.round(validResult.report.dimensions.heightMm)}×{Math.round(validResult.report.dimensions.depthMm)} мм · {(file.size / 1048576).toFixed(2)} MB · {Math.round(validResult.report.triangles)} triangles</p>
      {issues.map(issue => <p key={issue} className="text-xs text-red-700">{issue}</p>)}
      {validResult.report.warnings.map(warning => <p key={warning} className="text-xs text-black/60">{warning}</p>)}
      <p className="text-xs">Улаан X · ногоон Y (дээш) · цэнхэр +Z (нүүр). Grid = Y 0. Preview загварыг сунгахгүй.</p>
      {allowFrontProjection && <label className="block text-xs">+Z нүүрний бариулын илүү гарсан хэмжээ (мм)
        <input className="input ml-2 w-24" type="number" min={0} max={100} step={0.1} value={frontProjectionMm} onChange={event => setFrontProjectionMm(Number(event.target.value))} />
        <span className="block text-black/60">Зөвхөн бариулын projection. Их биеийн буруу гүнийг үүгээр далдлахгүй; нүүрэн тал ба их биеийн гүнийг батална.</span>
      </label>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!valid} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Босоо байрлал, +Z нүүрэн тал зөв болохыг шалгалаа.</label>
    </>}
  </section>;
}
