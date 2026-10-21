"use client";
import { useState } from "react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useDesigns } from "@/store/designs";

export function FurnitureLibrary() {
  const { furniture, rememberFurniture, removeFurniture } = useDesigns();
  const [name, setName] = useState(""),
    [size, setSize] = useState({ w: 100, d: 60, h: 80 }),
    [quantity, setQuantity] = useState(1),
    [color, setColor] = useState("#b6a48e");
  const [error, setError] = useState("");
  return (
    <section id="furniture" className="account-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="account-eyebrow">Өөрийн тавилгын сан</p>
          <h2 className="text-xl font-semibold">
            Миний тавилга{" "}
            <span className="account-count">{furniture.length}</span>
          </h2>
        </div>
        <Link href="/planner" className="account-button">
          Өрөөнд байрлуулах
        </Link>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Өрөөнд нэмсэн тавилга энд хадгалагдана. Өөрт байгаа тавилгаа хэмжээгээр
        нь бүртгээд “Миний тавилга” сонголтоор өрөөг автоматаар тохижуулж болно.
      </p>
      <form
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !name.trim() ||
            !Object.values(size).every(
              (v) => Number.isFinite(v) && v >= 5 && v <= 1000,
            )
          ) {
            setError("Нэр болон 5–1000 см хоорондох хэмжээг оруулна уу.");
            return;
          }
          rememberFurniture(
            {
              instanceId: crypto.randomUUID(),
              productId: `own_${crypto.randomUUID()}`,
              x: 0,
              z: 0,
              rotation: 0,
              color,
              material: "wood",
              details: {
                name: name.trim(),
                dimensions: {
                  w: size.w / 100,
                  d: size.d / 100,
                  h: size.h / 100,
                },
              },
            },
            quantity,
          );
          setName("");
          setError("");
        }}
      >
        <label className="col-span-2 text-sm sm:col-span-5">
          Тавилгын нэр
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="Жишээ: Миний буйдан"
          />
        </label>
        {(["w", "d", "h"] as const).map((key, i) => (
          <label key={key} className="text-sm">
            {["Өргөн", "Гүн", "Өндөр"][i]} · см
            <input
              required
              type="number"
              min={5}
              max={1000}
              value={size[key]}
              onChange={(e) =>
                setSize({ ...size, [key]: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
        ))}
        <label className="text-sm">
          Тоо ширхэг
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
        <label className="text-sm">
          Өнгө
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-1 h-10 w-full"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="col-span-2 text-sm text-red-600 sm:col-span-5"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="account-button account-button-primary col-span-2 sm:col-span-5"
        >
          Тавилга хадгалах
        </button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {furniture.map((item) => (
          <article key={item.id} className="rounded-xl border p-3">
            <strong>{item.name}</strong>
            <p className="mt-1 text-xs text-gray-600">
              {Object.values(item.dimensions)
                .map((v) => Math.round(v * 100))
                .join(" × ")}{" "}
              см · {item.quantity} ш · {item.piece.material}
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-red-700"
              onClick={() => removeFurniture(item.id)}
            >
              Сангаас хасах
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
