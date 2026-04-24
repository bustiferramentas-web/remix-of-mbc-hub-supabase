import { createFileRoute, Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ExpertFilterProvider } from "@/lib/expert-filter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MBC Hub — CRM interno" },
      { name: "description", content: "CRM interno da agência MBC para gestão de experts, produtos e alunos." },
      { property: "og:title", content: "MBC Hub — CRM interno" },
      { name: "twitter:title", content: "MBC Hub — CRM interno" },
      { property: "og:description", content: "CRM interno da agência MBC para gestão de experts, produtos e alunos." },
      { name: "twitter:description", content: "CRM interno da agência MBC para gestão de experts, produtos e alunos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5616e699-a277-4ae7-a92a-20c34610d705/id-preview-2ebda0e3--6c8eb351-4a93-47c8-83a0-c9fbea596d2d.lovable.app-1776879499158.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5616e699-a277-4ae7-a92a-20c34610d705/id-preview-2ebda0e3--6c8eb351-4a93-47c8-83a0-c9fbea596d2d.lovable.app-1776879499158.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <ExpertFilterProvider>
        <Outlet />
      </ExpertFilterProvider>
    </AuthProvider>
  );
}

export { createFileRoute };
