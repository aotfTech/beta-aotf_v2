 import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import "@/styles/docs-theme.css";

type DocsLayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: DocsLayoutProps) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}