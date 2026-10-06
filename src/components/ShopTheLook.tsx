"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Box, Check, Plus, ShoppingBag, X } from "lucide-react";
import type { Product } from "@/lib/types";
import type { RoomLook } from "@/lib/shopTheLook";
import { defaultCartSelection, marketplacePrice } from "@/lib/homeMarketplace";
import { priceFor } from "@/lib/products";
import { hasAvailableStock } from "@/lib/inventory";
import { useCart } from "@/store/cart";

function LookProduct({ product, close }: { product: Product; close: () => void }) {
  const selection = defaultCartSelection(product);
  const [colorId, setColorId] = useState(selection?.color.id ?? "");
  const [message, setMessage] = useState("");
  const add = useCart(state => state.add);
  const color = product.colors.find(option => option.id === colorId);
  const price = selection ? priceFor(product, colorId, selection.material.id) : product.basePrice;
  const addToCart = () => {
    if (!selection || !color || !hasAvailableStock(product)) return;
    const added = add({ productId: product.id, name: product.name, image: product.image,
      color: color.id, material: selection.material.id, unitPrice: price, stockQuantity: product.stockQuantity });
    setMessage(added ? "Сагсанд нэмэгдлээ" : "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн");
  };

  return <article className="look-popover" id="look-product" aria-label={`${product.name} — сонголт`}>
    <button type="button" className="look-close" onClick={close} aria-label="Барааны сонголтыг хаах"><X size={16} /></button>
    <Link className="look-product-photo" href={`/product/${product.id}`}>
      <Image src={product.image} alt={product.name} fill sizes="90px" className="object-cover" />
    </Link>
    <div className="look-product-info">
      <p className="look-mini-label">Өрөөндөө хослуулах сонголт</p>
      <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
      <strong>{marketplacePrice(price)}</strong>
    </div>
    {product.colors.length > 0 && <fieldset className="look-colors">
      <legend>Өнгө: {color?.name}</legend>
      <div>{product.colors.map(option => <button key={option.id} type="button" title={option.name}
        aria-label={option.name} aria-pressed={colorId === option.id}
        onClick={() => { setColorId(option.id); setMessage(""); }}>
        <span style={{ backgroundColor: option.hex }} />
        {colorId === option.id && <Check size={12} aria-hidden="true" />}
      </button>)}</div>
    </fieldset>}
    <div className="look-product-actions">
      {product.model ? <Link href={`/product/${product.id}?view=3d&color=${encodeURIComponent(colorId)}`}><Box size={15} aria-hidden="true" />3D-ээр үзэх</Link>
        : <span className="look-no-model"><Box size={15} aria-hidden="true" />3D загвар нэмэгдээгүй</span>}
      <button type="button" onClick={addToCart} disabled={!selection || !hasAvailableStock(product)}>
        <ShoppingBag size={15} aria-hidden="true" />Сагсанд шууд хийх
      </button>
    </div>
    <p className="look-cart-message" role="status" aria-live="polite">{message}</p>
  </article>;
}

function RoomScene({ room }: { room: RoomLook }) {
  const [active, setActive] = useState<string | null>(null);
  const hotspotRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const product = room.products.find(item => item.id === active);
  const close = () => {
    setActive(null);
    lastTrigger.current?.focus();
  };

  return <div id="look-room" className="look-room" onKeyDown={event => {
    if (event.key === "Escape" && active) { event.preventDefault(); close(); }
  }}>
    <div className="look-scene">
    <div className="look-scene-picture" onPointerDown={event => {
      if (!(event.target as HTMLElement).closest(".look-hotspot, .look-popover")) setActive(null);
    }}>
      <Image key={room.image} src={room.image} alt={`${room.label} — бүрэн тохижуулсан өрөөний санаа`}
        fill priority={room.id === "living"} sizes="(max-width: 999px) 100vw, 850px" />
      <div className="look-scene-caption"><span>SHOP THE LOOK</span><h3>{room.description}</h3></div>
      {room.hotspots.map(point => {
        const item = room.products.find(candidate => candidate.id === point.productId)!;
        return <button type="button" key={item.id} className="look-hotspot"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          ref={element => { if (element) hotspotRefs.current.set(item.id, element); else hotspotRefs.current.delete(item.id); }}
          aria-label={`${item.name} — зураг, үнэ, өнгө үзэх`} aria-expanded={active === item.id}
          aria-controls={active === item.id ? "look-product" : undefined}
          onPointerEnter={event => { if (event.pointerType === "mouse") { lastTrigger.current = event.currentTarget; setActive(item.id); } }}
          onClick={event => { lastTrigger.current = event.currentTarget; setActive(item.id); }}>
          <Plus size={18} aria-hidden="true" />
        </button>;
      })}
      <p className="look-scene-note">Тохижуулалтын санаа · Зураг дахь тавилгатай хослуулах каталогийн сонголтууд</p>
    </div>
      {product && <LookProduct key={product.id} product={product} close={close} />}
    </div>
    <aside className="look-selection" aria-label={`${room.label} тавилгууд`}>
      <div className="look-selection-heading"><span>ЭНЭ ӨРӨӨНД</span><h3>{room.label}</h3><p>Таны орон зайд тохирох сонголтууд</p></div>
      <div className="look-selection-list">
        {room.products.map(item => {
          const selection = defaultCartSelection(item);
          return <button type="button" className="look-selection-item" key={item.id} aria-pressed={active === item.id}
            onClick={event => { lastTrigger.current = event.currentTarget; setActive(item.id); }} aria-controls={active === item.id ? "look-product" : undefined}>
            <span className="look-selection-photo"><Image src={item.image} alt="" fill sizes="64px" className="object-cover" /></span>
            <span><strong>{item.name}</strong><small>{marketplacePrice(selection?.unitPrice ?? item.basePrice)}</small></span>
            <Plus size={15} aria-hidden="true" />
          </button>;
        })}
        {!room.products.length && <p className="look-empty">Энэ өрөөний тавилгууд удахгүй нэмэгдэнэ.</p>}
      </div>
      <Link className="look-browse" href={`/catalog?room=${room.id}`}>Өрөөний бүх тавилга<ArrowRight size={16} aria-hidden="true" /></Link>
    </aside>
  </div>;
}

export function ShopTheLook({ rooms }: { rooms: RoomLook[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id);
  const room = rooms.find(item => item.id === roomId) ?? rooms[0];
  if (!room) return null;
  return <section className="shop-the-look" aria-labelledby="look-title">
    <div className="look-heading"><div><p>ГЭРЭЭ ТӨСӨӨЛ. СОНГОЛТОО ОЛ.</p><h2 id="look-title">Өрөөгөөр нь сонгох</h2></div>
      <span>Зураг дээрх + цэгийг дарж тавилгатай танилцаарай.</span></div>
    <div className="look-room-pills" role="group" aria-label="Өрөөгөөр сонгох">
      {rooms.map(item => <button type="button" key={item.id} aria-pressed={item.id === room.id}
        aria-controls="look-room" onClick={() => setRoomId(item.id)}>{item.label}</button>)}
    </div>
    <RoomScene key={room.id} room={room} />
  </section>;
}
