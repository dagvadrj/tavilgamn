import { InteriorHomePage } from "@/features/home-interior/InteriorHomePage";

export const metadata = {
  title: "Тавилга — гэрт хэрэгтэй бүх сонголт",
  description:
    "Тавилгын сонголтууд, дэлгүүрүүд болон гэрийн тохижилтын санаануудтай танилцаарай.",
};

export default async function HomePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ limit?: string }>;
}) {
  await searchParams;
  return <InteriorHomePage />;
}
