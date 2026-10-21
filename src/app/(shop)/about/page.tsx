import { redirect } from "next/navigation";

export default async function AboutRedirect({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  redirect(
    topic === "merchant" || topic === "advertising"
      ? `/?topic=${topic}#contact`
      : "/#contact",
  );
}
