export interface NavItem {
  title: string;
  href: string;
  badge?: string;
}

export interface DocsNavGroup {
  title: string;
  items: NavItem[];
}

export const siteConfig = {
  name: "API Route Explorer",
  shortName: "API Route Explorer",
  description:
    "Discover, analyze, test, and document backend API routes directly inside VS Code.",
  longDescription:
    "API Route Explorer is a developer-focused VS Code extension that automatically discovers, analyzes, tests, and documents backend API routes directly from your editor. Stop context switching between code, terminal windows, Postman, and Swagger docs.",
  url: "https://apirouteexplorer.dev",
  version: "1.5.1",
  author: {
    name: "Hussnain Ahmed",
    url: "https://github.com/hussnain-143",
    handle: "hussnain-143",
  },
  links: {
    github: "https://github.com/hussnain-143/api-route-explorer",
    marketplace:
      "https://marketplace.visualstudio.com/items?itemName=hussnain-143.api-route-explorer",
    issues: "https://github.com/hussnain-143/api-route-explorer/issues",
    license:
      "https://github.com/hussnain-143/api-route-explorer/blob/main/LICENSE",
    releases: "https://github.com/hussnain-143/api-route-explorer/releases",
  },
  install: {
    cli: "code --install-extension hussnain-143.api-route-explorer",
    ext: "ext install hussnain-143.api-route-explorer",
  },
  frameworks: [
    {
      name: "Express",
      tagline: "app.get(), router.post(), nested routers, parameters",
      desc: "Static AST extraction of app/router verb calls, sub-router prefixes, and middleware chains.",
      example: "router.get('/users/:id', authMiddleware, getUserById);",
    },
    {
      name: "Next.js App Router",
      tagline: "app/api/**/route.ts, [param], [...slug]",
      desc: "Zero-config file-system routing inspection for exported HTTP handler functions.",
      example: "export async function GET(req: Request, { params }: { params: { id: string } })",
    },
    {
      name: "Next.js Pages Router",
      tagline: "pages/api/**/*.ts",
      desc: "Default export and method switch-case AST scanning for legacy and hybrid Next.js backends.",
      example: "export default function handler(req: NextApiRequest, res: NextApiResponse)",
    },
    {
      name: "Fastify",
      tagline: "fastify.get(), fastify.route(), plugins, prefixes",
      desc: "Modular plugin tree tracking with fastify instance registrations and route options.",
      example: "fastify.get('/items', { preHandler: auth }, getItems);",
    },
    {
      name: "NestJS",
      tagline: "@Controller(), @Get(), @Post(), @Param()",
      desc: "Decorator-driven route mapping combining controller path prefixes and action decorators.",
      example: "@Controller('users')\n@Get(':id')\ngetUser(@Param('id') id: string) {}",
    },
  ],
  navItems: [
    { title: "Features", href: "/features" },
    { title: "Frameworks", href: "/frameworks" },
    { title: "Docs", href: "/docs" },
    { title: "Security", href: "/security" },
    { title: "Changelog", href: "/changelog" },
  ] as NavItem[],
  docsNavigation: [
    {
      title: "Overview",
      items: [
        { title: "Introduction", href: "/docs" },
        { title: "Getting Started", href: "/docs/getting-started" },
      ],
    },
    {
      title: "Core Guides",
      items: [
        { title: "Route Discovery", href: "/docs/route-discovery" },
        { title: "Route Analysis", href: "/docs/route-analysis" },
        { title: "Native HTTP Client", href: "/docs/http-client" },
        { title: "OpenAPI Generation", href: "/docs/openapi" },
      ],
    },
    {
      title: "Help & Reference",
      items: [
        { title: "Troubleshooting", href: "/docs/troubleshooting" },
        { title: "Installation", href: "/install" },
      ],
    },
  ] as DocsNavGroup[],
};
