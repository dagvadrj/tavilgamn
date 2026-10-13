"use client";

import { createCabinet } from "@/lib/kitchenCabinets";
import { parseKitchenGlbAssembly,type KitchenGlbAssembly } from "@/lib/kitchenGlbAssembly";
import type { KitchenCatalogVariant,KitchenModelCandidate } from "@/lib/kitchenModuleCatalog";
import { KitchenCabinetGLB } from "@/three/KitchenCabinetGLB";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo,useState } from "react";

export default function AdminKitchenAssemblyPreview({ assembly, models, baseModel }: {
  assembly: KitchenGlbAssembly | null; models: KitchenModelCandidate[]; baseModel: KitchenModelCandidate;
}) {
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => {
    try {
      const parsed = assembly ? parseKitchenGlbAssembly(assembly) : null;
      if (parsed) for (const slot of parsed.slots) for (const option of slot.options) {
        option.glbFile = models.find(model => model.id === option.modelId)?.glbFile;
      }
      return { assembly: parsed, error: null };
    } catch (error) { return { assembly: null, error: error instanceof Error ? error.message : "Эд ангийн тохиргоог шалгана уу." }; }
  }, [assembly, models]);
  const variant: KitchenCatalogVariant = {
    furnitureModelId: baseModel.id, productId: baseModel.productId, modelName: baseModel.name,
    variantCode: "PREVIEW", opening: "doors", doorCount: 1, drawerCount: 0,
    configuration: preview.assembly ? { assembly: preview.assembly } : {}, isDefault: false,
    sortOrder: 0, active: true, glbFile: baseModel.glbFile ?? null, glbUrl: null,
    previewGlbFile: null, previewGlbUrl: null, thumbnailUrl: null, processingStatus: "ready", physicalSize: true,
  };
  const cabinet = { ...createCabinet("base", "assembly-preview"), width: baseModel.widthMm, height: baseModel.heightMm, depth: baseModel.depthMm };
  const h = baseModel.heightMm / 1000;
  const distance = Math.max(h, baseModel.widthMm / 1000, baseModel.depthMm / 1000) * 1.7;
  return <div className="overflow-hidden rounded-lg border border-black/10" aria-label="Угсарсан шүүгээний 3D preview">
    <div className="flex items-center justify-between bg-white px-3 py-2 text-xs"><strong>Угсралтыг шалгах · 3D</strong><button type="button" className="btn-ghost !min-h-8 text-xs" aria-pressed={open} onClick={() => setOpen(value => !value)}>{open ? "Хаах" : "Нээж шалгах"}</button></div>
    {preview.error ? <p role="status" className="p-4 text-xs text-amber-700">{preview.error}</p> : <div className="h-80 bg-[#f5f6f7]">
      <Canvas key={baseModel.id} camera={{ position: [distance, h * .7 + distance * .4, distance], fov: 45 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#f5f6f7"]}/>
        <ambientLight intensity={1.6}/><directionalLight position={[4, 5, 4]} intensity={3}/>
        <KitchenCabinetGLB cabinet={cabinet} variant={variant} open={open}/>
        <gridHelper args={[Math.max(3, distance * 2), 20, "#ccd0d4", "#e3e5e7"]}/>
        <axesHelper args={[.3]}/><OrbitControls target={[0, h / 2, 0]} makeDefault enableDamping/>
      </Canvas>
    </div>}
    <p className="bg-white px-3 py-2 text-xs text-black/55">Эргүүлж хараад, хаалга болон бариул зөв цэгт байрлаж буйг шалгана уу. Байрлалыг мм-ээр эсвэл GLB-ийн anchor node-оор тохируулна.</p>
  </div>;
}
