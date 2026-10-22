"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type {
  KitchenGlbAssembly,
  KitchenPartKind,
  KitchenPartVector,
} from "@/lib/kitchenGlbAssembly";
import type { KitchenModelCandidate } from "@/lib/kitchenModuleCatalog";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { bindCabinetPart, reuseCabinetPart } from "@/lib/kitchenCabinetSetup";
const Preview = dynamic(() => import("./AdminKitchenAssemblyPreview"), {
  ssr: false,
});

export function AdminKitchenCabinetSetup({
  assembly,
  onChange,
  models,
  baseModel,
  materials,
  onUpload,
}: {
  assembly: KitchenGlbAssembly;
  onChange: (value: KitchenGlbAssembly) => void;
  models: KitchenModelCandidate[];
  baseModel: KitchenModelCandidate;
  materials: KitchenMaterialDefinition[];
  onUpload: (slotId: string, kind: KitchenPartKind) => void;
}) {
  const [step, setStep] = useState<"fronts" | "handles" | "preview">("fronts");
  const fronts = assembly.slots.filter(
    (slot) =>
      slot.kind === "door" ||
      slot.kind === "drawer-front" ||
      slot.kind === "drawer",
  );
  const patch = (
    id: string,
    values: Partial<KitchenGlbAssembly["slots"][number]>,
  ) =>
    onChange({
      ...assembly,
      slots: assembly.slots.map((slot) =>
        slot.id === id ? { ...slot, ...values } : slot,
      ),
    });
  const setVector = (id: string, value: KitchenPartVector) =>
    patch(id, { positionMm: value });
  return (
    <section className="ak-setup" aria-label="Шүүгээ угсрах">
      <nav className="ak-setup-steps" aria-label="Угсралтын алхам">
        {(
          [
            ["fronts", "2. Хаалга / шургуулга"],
            ["handles", "3. Бариул"],
            ["preview", "4. Шалгах"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={step === value ? "step" : undefined}
            onClick={() => setStep(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {step === "fronts" && (
        <>
          <p className="ak-help">
            Хаалга бүрийн GLB-г холбоно. Нугасны origin-оос байрлуулах тул доорх
            байрлалыг бодит загвартайгаа тааруулж, 3D дээр шалгана. Бүтэн
            шүүгээний хаалга их бие дотор давхар байж болохгүй.
          </p>
          {!fronts.length && (
            <p className="ak-help">
              Энэ хийцэд тусдаа хаалга, шургуулга шаардлагагүй.
            </p>
          )}
          <div className="ak-setup-parts">
            {fronts.map((slot, index) => {
              const choice = slot.options.find(
                  (option) => option.id === slot.defaultOptionId,
                ),
                selected = models.find((model) => model.id === choice?.modelId);
              const choices = models.filter(
                (model) =>
                  !model.archivedAt &&
                  (model.partKind === slot.kind ||
                    (slot.kind === "drawer-front" &&
                      model.partKind === "drawer")),
              );
              return (
                <article className="ak-setup-part" key={slot.id}>
                  <h3>{slot.label}</h3>
                  <label className="label">
                    GLB сангаас сонгох
                    <select
                      className="input"
                      value={choice?.modelId ?? ""}
                      onChange={(event) => {
                        const model = models.find(
                          (model) => model.id === event.target.value,
                        );
                        if (model)
                          onChange(bindCabinetPart(assembly, slot.id, model));
                        else
                          patch(slot.id, {
                            options: [
                              { id: "default", label: slot.label, modelId: "" },
                            ],
                            defaultOptionId: "default",
                          });
                      }}
                    >
                      <option value="">Файлаа сонгоно уу</option>
                      {choices.map((model) => (
                        <option
                          key={model.id}
                          value={model.id}
                          disabled={
                            !model.glbReady && model.id !== choice?.modelId
                          }
                        >
                          {model.name} · {model.widthMm}×{model.heightMm}×
                          {model.depthMm} мм
                          {!model.glbReady ? " · боловсруулж байна" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ak-setup-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onUpload(slot.id, slot.kind)}
                    >
                      Шинэ GLB оруулах
                    </button>
                    {index > 0 &&
                      fronts[index - 1].kind === slot.kind &&
                      fronts[index - 1].options[0]?.modelId && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            onChange(
                              reuseCabinetPart(
                                assembly,
                                slot.id,
                                fronts[index - 1].id,
                                models,
                              ),
                            );
                          }}
                        >
                          Өмнөхтэй ижил GLB
                          {slot.kind === "door" ? " · толин тусгал" : ""}
                        </button>
                      )}
                  </div>
                  {selected && (
                    <p className="ak-help">
                      {selected.glbReady
                        ? "✓ GLB бэлэн"
                        : "Боловсруулж байна — бэлэн болмогц хадгална."}
                    </p>
                  )}
                  <details>
                    <summary>Байрлал ба нээх хөдөлгөөн</summary>
                    <div className="ak-setup-position">
                      {slot.positionMm.map((value, axis) => (
                        <label className="label" key={axis}>
                          {
                            ["X · зүүн/баруун", "Y · өндөр", "Z · урагш/хойш"][
                              axis
                            ]
                          }{" "}
                          · мм
                          <input
                            type="number"
                            className="input"
                            value={value}
                            onChange={(event) => {
                              const next = [
                                ...slot.positionMm,
                              ] as KitchenPartVector;
                              next[axis] = Number(event.target.value);
                              setVector(slot.id, next);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <label className="label">
                      {slot.motion?.type === "hinge"
                        ? "Нээх өнцөг · градус"
                        : "Татах зай · мм"}
                      <input
                        type="number"
                        className="input"
                        value={slot.motion?.amount ?? 0}
                        onChange={(event) =>
                          patch(slot.id, {
                            motion: {
                              type: slot.kind === "door" ? "hinge" : "slide",
                              axis: slot.kind === "door" ? "y" : "z",
                              pivotMm: slot.motion?.pivotMm ?? [0, 0, 0],
                              amount: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </details>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep("handles")}
          >
            Дараах: бариул →
          </button>
        </>
      )}
      {step === "handles" && (
        <>
          <p className="ak-help">
            Бариул сонгохгүй бол загвартаа бариул нэмэхгүй. Сонгосон бариул
            хаалгаа дагаж хөдөлнө.
          </p>
          <div className="ak-setup-parts">
            {fronts.map((front) => {
              const id = `handle-${front.id}`,
                slot = assembly.slots.find((item) => item.id === id),
                choice = slot?.options[0];
              return (
                <article key={id} className="ak-setup-part">
                  <h3>{front.label} · бариул</h3>
                  <label className="label">
                    Бариулын GLB
                    <select
                      className="input"
                      value={choice?.modelId ?? ""}
                      onChange={(event) => {
                        const model = models.find(
                          (model) => model.id === event.target.value,
                        );
                        const rest = assembly.slots.filter(
                          (item) => item.id !== id,
                        );
                        if (!model) {
                          onChange({ ...assembly, slots: rest });
                          return;
                        }
                        const handle: KitchenGlbAssembly["slots"][number] =
                          slot ?? {
                            id,
                            label: `${front.label} бариул`,
                            kind: "handle",
                            parentSlotId: front.id,
                            positionMm: [0, 0, 0],
                            rotationDeg: [0, 0, 0],
                            scale: [1, 1, 1],
                            hideNodes: [],
                            optional: true,
                            defaultOptionId: "default",
                            options: [],
                          };
                        onChange(
                          bindCabinetPart(
                            { ...assembly, slots: [...rest, handle] },
                            id,
                            model,
                          ),
                        );
                      }}
                    >
                      <option value="">Бариулгүй / дараа тохируулах</option>
                      {models
                        .filter(
                          (model) =>
                            model.partKind === "handle" &&
                            model.glbReady &&
                            !model.archivedAt,
                        )
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onUpload(id, "handle")}
                  >
                    Бариулын GLB оруулах
                  </button>
                  {slot && (
                    <div className="ak-setup-position">
                      {slot.positionMm.map((value, axis) => (
                        <label className="label" key={axis}>
                          {["X", "Y", "Z"][axis]} · мм
                          <input
                            className="input"
                            type="number"
                            value={value}
                            onChange={(event) => {
                              const next = [
                                ...slot.positionMm,
                              ] as KitchenPartVector;
                              next[axis] = Number(event.target.value);
                              setVector(id, next);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep("preview")}
          >
            Дараах: угсралтаа шалгах →
          </button>
        </>
      )}
      {step === "preview" && (!baseModel.glbReady || !baseModel.glbFile) && (
        <p role="status">
          Их биеийн GLB боловсруулагдаж байна. Бэлэн болмогц угсралтаа шалгана
          уу.
        </p>
      )}
      {step === "preview" && baseModel.glbReady && baseModel.glbFile && (
        <Preview
          assembly={assembly}
          models={models}
          baseModel={baseModel}
          materials={materials}
        />
      )}
    </section>
  );
}
