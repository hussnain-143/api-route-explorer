"use client";

import { useState } from "react";
import { siteConfig } from "@/lib/site-config";

interface PreviewRouteData {
  method: "GET" | "POST" | "DELETE";
  path: string;
  group: string;
  resolvedUrl: string;
  paramLabel: string;
  paramName: string;
  paramValue: string;
  headerKey: string;
  headerValue: string;
  requestBody: string;
  curl: string;
  status: string;
  timeMs: number;
  size: string;
  responseBody: string;
}

const PREVIEW_ROUTES: PreviewRouteData[] = [
  {
    method: "POST",
    path: "/api/v1/auth/login",
    group: "Auth",
    resolvedUrl: "http://localhost:5000/api/v1/auth/login",
    paramLabel: "Body Schema",
    paramName: "email, password",
    paramValue: "•••••••• (masked)",
    headerKey: "Content-Type",
    headerValue: "application/json",
    requestBody: `{ "email": "alex.mercer@example.com", "password": "••••••••" }`,
    curl: `curl -X POST "http://localhost:5000/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"alex.mercer@example.com","password":"***"}'`,
    status: "200 OK",
    timeMs: 38,
    size: "0.9 KB",
    responseBody: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123",
    "email": "alex.mercer@example.com",
    "role": "lead_engineer"
  }
}`,
  },
  {
    method: "POST",
    path: "/api/v1/auth/refresh",
    group: "Auth",
    resolvedUrl: "http://localhost:5000/api/v1/auth/refresh",
    paramLabel: "Variable",
    paramName: "{{token}}",
    paramValue: "eyJhbGciOiJIUzI1Ni...",
    headerKey: "Authorization",
    headerValue: "Bearer {{token}}",
    requestBody: `{ "refreshToken": "rt_98f72a1b4c" }`,
    curl: `curl -X POST "http://localhost:5000/api/v1/auth/refresh" -H "Authorization: Bearer {{token}}" -d '{"refreshToken":"rt_98f72a1b4c"}'`,
    status: "200 OK",
    timeMs: 22,
    size: "0.5 KB",
    responseBody: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
  "expiresIn": 3600
}`,
  },
  {
    method: "GET",
    path: "/api/v1/users",
    group: "Users",
    resolvedUrl: "http://localhost:5000/api/v1/users?role=engineer&limit=20",
    paramLabel: "Query Param",
    paramName: "role",
    paramValue: "engineer",
    headerKey: "Accept",
    headerValue: "application/json",
    requestBody: `// GET request — no body payload`,
    curl: `curl -X GET "http://localhost:5000/api/v1/users?role=engineer&limit=20" -H "Accept: application/json"`,
    status: "200 OK",
    timeMs: 31,
    size: "2.4 KB",
    responseBody: `{
  "total": 2,
  "items": [
    { "id": "usr_123", "name": "Alex Mercer", "role": "lead_engineer" },
    { "id": "usr_124", "name": "Sara Chen", "role": "staff_engineer" }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/users/{id}",
    group: "Users",
    resolvedUrl: "http://localhost:5000/api/v1/users/usr_123",
    paramLabel: "Path Param",
    paramName: "id",
    paramValue: "usr_123",
    headerKey: "Authorization",
    headerValue: "Bearer eyJhbGciOi...",
    requestBody: `// GET request — no body payload`,
    curl: `curl -X GET "http://localhost:5000/api/v1/users/usr_123" -H "Authorization: Bearer token_xyz"`,
    status: "200 OK",
    timeMs: 40,
    size: "1.2 KB",
    responseBody: `{
  "id": "usr_123",
  "name": "Alex Mercer",
  "email": "alex.mercer@example.com",
  "role": "lead_engineer",
  "status": "active"
}`,
  },
  {
    method: "DELETE",
    path: "/api/v1/users/{id}",
    group: "Users",
    resolvedUrl: "http://localhost:5000/api/v1/users/usr_123",
    paramLabel: "Path Param",
    paramName: "id",
    paramValue: "usr_123",
    headerKey: "Authorization",
    headerValue: "Bearer {{token}}",
    requestBody: `{}`,
    curl: `curl -X DELETE "http://localhost:5000/api/v1/users/usr_123" -H "Authorization: Bearer {{token}}"`,
    status: "200 OK",
    timeMs: 29,
    size: "0.3 KB",
    responseBody: `{
  "deleted": true,
  "id": "usr_123"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/admin/metrics",
    group: "Admin",
    resolvedUrl: "http://localhost:5000/api/v1/admin/metrics",
    paramLabel: "Query Param",
    paramName: "window",
    paramValue: "24h",
    headerKey: "Authorization",
    headerValue: "Bearer {{token}}",
    requestBody: `// GET request — no body payload`,
    curl: `curl -X GET "http://localhost:5000/api/v1/admin/metrics" -H "Authorization: Bearer {{token}}"`,
    status: "200 OK",
    timeMs: 18,
    size: "1.6 KB",
    responseBody: `{
  "uptimeSeconds": 86400,
  "requestsPerMinute": 1420,
  "p95LatencyMs": 24.5,
  "healthyRoutes": 118
}`,
  },
];

export function ProductPreview() {
  const [selectedRouteKey, setSelectedRouteKey] = useState<string>("GET /api/v1/users/{id}");
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body" | "curl">("params");
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeRoute =
    PREVIEW_ROUTES.find((r) => `${r.method} ${r.path}` === selectedRouteKey) || PREVIEW_ROUTES[3];

  const getMethodColor = (m: string) => {
    switch (m) {
      case "GET":
        return "text-cyan-400 bg-cyan-950/60 border-cyan-800/40";
      case "POST":
        return "text-emerald-400 bg-emerald-950/60 border-emerald-800/40";
      case "DELETE":
        return "text-rose-400 bg-rose-950/60 border-rose-800/40";
      default:
        return "text-amber-400 bg-amber-950/60 border-amber-800/40";
    }
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(activeRoute.curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => setIsSending(false), 260);
  };

  return (
    <div className="w-full rounded-2xl border border-[var(--surface-border-strong)] bg-[#070a0e] shadow-2xl overflow-hidden text-left font-mono text-xs">
      {/* VS Code Window Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0f15] border-b border-[var(--surface-border)] select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-3 text-[11px] text-[var(--muted)] hidden sm:inline">
            api-routes-explorer — Visual Studio Code
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <span className="hidden md:inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ⚡ CodeLens Active
          </span>
          <span className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
            v{siteConfig.version}
          </span>
        </div>
      </div>

      {/* Main VS Code Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Activity Bar Tree View */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[var(--surface-border)] bg-[#080d13] p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
            <span className="font-semibold text-xs text-[var(--foreground)] tracking-wider uppercase">
              Routes Explorer
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              {PREVIEW_ROUTES.length} routes
            </span>
          </div>

          <div className="space-y-1">
            {PREVIEW_ROUTES.map((r) => {
              const fullRoute = `${r.method} ${r.path}`;
              const isSelected = selectedRouteKey === fullRoute;
              return (
                <button
                  type="button"
                  key={fullRoute}
                  onClick={() => {
                    setSelectedRouteKey(fullRoute);
                    if (r.method === "POST") {
                      setActiveTab("body");
                    } else {
                      setActiveTab("params");
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${getMethodColor(
                        r.method
                      )}`}
                    >
                      {r.method}
                    </span>
                    <span className="truncate">{r.path}</span>
                  </div>
                  <span className="text-[10px] opacity-60 ml-2">⚡</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] text-[11px] text-[var(--muted)] flex items-center justify-between">
            <span>Group: {activeRoute.group}</span>
            <span className="text-emerald-400">● Healthy</span>
          </div>
        </div>

        {/* HTTP Client Webview */}
        <div className="lg:col-span-8 bg-[#05070a] flex flex-col justify-between p-4 sm:p-6 space-y-6">
          {/* URL & Send Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span
                className={`px-2.5 py-1.5 rounded-lg border font-bold text-center ${getMethodColor(
                  activeRoute.method
                )}`}
              >
                {activeRoute.method}
              </span>
              <div className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)] flex items-center justify-between overflow-x-auto">
                <span className="truncate">{activeRoute.resolvedUrl}</span>
                <span className="text-[10px] text-emerald-400 ml-2 shrink-0">
                  {isSending ? "● Sending..." : "● Ready"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSend}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all shadow-sm shadow-emerald-500/20"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>

            {/* Config Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab("params")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === "params"
                    ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Params (1)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("headers")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === "headers"
                    ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Headers (1)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("body")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === "body"
                    ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Body (JSON)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("curl");
                  copyCurl();
                }}
                className={`px-2.5 py-1 rounded transition-colors ml-auto border border-[var(--surface-border)] ${
                  activeTab === "curl"
                    ? "bg-[var(--surface-hover)] text-emerald-400"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {copiedCurl ? "✓ cURL Copied" : "cURL"}
              </button>
            </div>

            {/* Active Tab Content */}
            <div className="p-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
              {activeTab === "params" && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--muted)]">
                    {activeRoute.paramLabel}{" "}
                    <code className="text-emerald-400">{activeRoute.paramName}</code>:
                  </span>
                  <span className="text-[var(--foreground)] font-bold">
                    {activeRoute.paramValue}
                  </span>
                </div>
              )}
              {activeTab === "headers" && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--muted)]">{activeRoute.headerKey}:</span>
                  <span className="text-[var(--foreground)] truncate max-w-[240px]">
                    {activeRoute.headerValue}
                  </span>
                </div>
              )}
              {activeTab === "body" && (
                <div className="text-[11px] text-[var(--muted)] overflow-x-auto">
                  <code>{activeRoute.requestBody}</code>
                </div>
              )}
              {activeTab === "curl" && (
                <div className="text-[11px] text-[var(--muted)] truncate">
                  <code>{activeRoute.curl}</code>
                </div>
              )}
            </div>
          </div>

          {/* Response Inspector */}
          <div className="rounded-xl border border-[var(--surface-border)] bg-[#030508] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {activeRoute.status}
                </span>
                <span className="text-[var(--muted)]">{activeRoute.timeMs} ms</span>
                <span className="text-[var(--muted)]">{activeRoute.size}</span>
              </div>
              <span className="text-[var(--muted)]">application/json</span>
            </div>

            <pre className="text-emerald-300 text-[11px] leading-relaxed overflow-x-auto">
              {activeRoute.responseBody}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
