"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { ArrowUpRight, Star, Store } from "lucide-react";

type FeaturedStore = {
  id: string;
  name: string;

  storeType: string;

  city: string;
  district: string;

  description: string;
  image: string;

  categories: string[];

  featuredRank: number;
};

export function FeaturedMerchants() {
  const [stores, setStores] = useState<FeaturedStore[]>([]);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/stores/featured", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Featured stores");
        }

        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStores(Array.isArray(data?.stores) ? data.stores : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStores([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoaded(true);
        }
      });

    return () => controller.abort();
  }, []);

  if (!loaded || !stores.length) {
    return null;
  }

  return (
    <section className="featured-merchants">
      <div className="featured-merchants-heading">
        <div>
          <span>
            <Star size={14} />
            FEATURED STORES
          </span>

          <h2>Онцлох дэлгүүрүүд</h2>

          <p>Манай marketplace-ийн онцлох тавилгын дэлгүүрүүд.</p>
        </div>

        <Link href="/stores">
          Бүх дэлгүүр
          <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="featured-merchants-grid">
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/catalog/stores/${store.id}`}
            className="featured-merchant-card"
          >
            <div className="featured-merchant-image">
              {store.image ? (
                <Image
                  src={store.image}
                  alt={store.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : (
                <Store size={30} />
              )}

              <span>
                <Star size={12} fill="currentColor" />
                Featured
              </span>
            </div>

            <div className="featured-merchant-body">
              <div>
                <h3>{store.name}</h3>

                <p>
                  {store.city}
                  {store.district ? ` · ${store.district}` : ""}
                </p>
              </div>

              <ArrowUpRight size={18} />
            </div>

            {store.description && (
              <p className="featured-merchant-description">
                {store.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
