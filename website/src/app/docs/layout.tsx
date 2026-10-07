import { DocsSidebar } from "@/components/DocsSidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <div className="flex flex-col lg:flex-row gap-10">
        <DocsSidebar />
        <article className="flex-1 min-w-0 max-w-4xl">{children}</article>
      </div>
    </div>
  );
}
