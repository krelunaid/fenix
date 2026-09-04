import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  callTool,
  CONNECTOR_ARGS_MAX_BYTES,
  failureMemoSize,
  validateConnectorCall,
} from "./client.server.ts";
import { FENIX_CONNECTOR_CATALOG } from "./catalog.ts";
import { ConnectorType } from "./types.ts";
import type { ToolArgs } from "./types.ts";
import { isLoginRequired, redirectToLoginIfRequired } from "./login.ts";
import { classifyCallToolError } from "./errors.ts";
import type { CallToolResult } from "./types.ts";

type WindowStub = {
  location: { assign: (url: string) => void; href: string };
  self?: unknown;
  top?: unknown;
  open?: (url: string, target: string) => unknown;
};

function withWindow<T>(stub: WindowStub, fn: () => T): T {
  (globalThis as { window?: unknown }).window = stub;
  try {
    return fn();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.sig`;
}

async function withStubbedGate(
  status: number,
  body: Record<string, unknown>,
  run: (calls: () => number) => Promise<void>,
): Promise<void> {
  process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  try {
    await run(() => calls);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GROK_CONNECTORS_URL;
  }
}

describe("Fenix connector catalog contract", () => {
  it("declares seven unique gate families without exposing credentials", () => {
    assert.equal(FENIX_CONNECTOR_CATALOG.length, 7);
    assert.equal(
      new Set(FENIX_CONNECTOR_CATALOG.map((entry) => entry.type)).size,
      FENIX_CONNECTOR_CATALOG.length,
    );
    for (const entry of FENIX_CONNECTOR_CATALOG) {
      assert.equal(entry.authentication, "edge-gate");
      assert.equal(entry.credentialExposure, "server-only");
      assert.equal(entry.toolAuthorization, "grant-allowlist");
      assert.equal(entry.catalogIdRequired, entry.type === ConnectorType.Mcp);
    }
  });

  it("bounds names, MCP ids, shape, depth, nodes and serialized bytes", () => {
    const drive = { connectorType: ConnectorType.GoogleDrive };
    assert.equal(validateConnectorCall("google_drive_search", { q: "argilla" }, drive), null);
    assert.match(validateConnectorCall("../escape", {}, drive) ?? "", /toolName/);
    assert.match(
      validateConnectorCall("google_drive_search", {}, {
        ...drive,
        connectorCatalogId: "confused-deputy",
      }) ?? "",
      /only for Mcp/,
    );
    assert.match(
      validateConnectorCall("mcp_search", {}, { connectorType: ConnectorType.Mcp }) ?? "",
      /connectorCatalogId/,
    );
    assert.equal(
      validateConnectorCall("mcp_search", {}, {
        connectorType: ConnectorType.Mcp,
        connectorCatalogId: "catalog:argilla-v1",
      }),
      null,
    );

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.match(validateConnectorCall("fixture", circular, drive) ?? "", /circular/);
    assert.match(
      validateConnectorCall(
        "fixture",
        JSON.parse('{"__proto__":{"polluted":true}}') as ToolArgs,
        drive,
      ) ?? "",
      /blocked key/,
    );
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let index = 0; index < 10; index += 1) {
      deep.next = {};
      deep = deep.next as Record<string, unknown>;
    }
    assert.match(validateConnectorCall("fixture", root, drive) ?? "", /deeply nested/);
    assert.match(
      validateConnectorCall("fixture", { body: "x".repeat(CONNECTOR_ARGS_MAX_BYTES) }, drive) ??
        "",
      /exceed/,
    );
    assert.match(validateConnectorCall("fixture", { n: Number.NaN }, drive) ?? "", /non-finite/);
  });

  it("forwards every family through the server gate and keeps the bearer out of the body", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    const realFetch = globalThis.fetch;
    const requests: Array<{ authorization: string | null; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (_url, init) => {
      requests.push({
        authorization: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, data: { accepted: true } }), { status: 200 });
    }) as typeof fetch;
    try {
      for (const [index, entry] of FENIX_CONNECTOR_CATALOG.entries()) {
        const token = fakeJwt({ sub: `catalog-user-${index}`, team_id: "argilla" });
        const result = await callTool(
          `fixture_${entry.type.toLowerCase()}`,
          { cursor: index },
          {
            connectorType: entry.type,
            token,
            ...(entry.catalogIdRequired ? { connectorCatalogId: "catalog:fixture-v1" } : {}),
          },
        );
        assert.equal(result.ok, true);
        assert.equal(requests[index]?.authorization, `Bearer ${token}`);
        assert.equal(JSON.stringify(requests[index]?.body).includes(token), false);
        assert.equal(requests[index]?.body.connector_type, entry.type);
      }
      assert.equal(requests.length, FENIX_CONNECTOR_CATALOG.length);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("callTool failure memo", () => {
  it("replays an identical failure within the memo window without refetching", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async (calls) => {
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: fakeJwt({ sub: "memo-user-1", iat: 1000, exp: 2000 }),
      };
      const first = await callTool("google_drive_search", { q: "memo" }, options);
      const second = await callTool("google_drive_search", { q: "memo" }, options);
      assert.equal(first.ok, false);
      assert.equal(first.errorMessage, "boom");
      assert.deepEqual(second, first);
      assert.equal(calls(), 1);
    });
  });

  it("keys by token identity so a reminted token shares the memo entry", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async (calls) => {
      const first = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-2", iat: 1000, exp: 2000 }),
        },
      );
      const second = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-2", iat: 1001, exp: 2001 }),
        },
      );
      assert.equal(first.ok, false);
      assert.deepEqual(second, first);
      assert.equal(calls(), 1);

      const other = await callTool(
        "google_drive_search",
        { q: "remint" },
        {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-3", iat: 1000, exp: 2000 }),
        },
      );
      assert.equal(other.ok, false);
      assert.equal(calls(), 2);
    });
  });

  it("sweeps expired entries on write so unique keys do not accumulate", async () => {
    await withStubbedGate(500, { ok: false, errorMessage: "boom" }, async () => {
      mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
      try {
        const sizeBefore = failureMemoSize();
        const options = {
          connectorType: ConnectorType.GoogleDrive,
          token: fakeJwt({ sub: "memo-user-5", iat: 1000, exp: 2000 }),
        };
        await callTool("google_drive_search", { q: "sweep-a" }, options);
        await callTool("google_drive_search", { q: "sweep-b" }, options);
        assert.equal(failureMemoSize(), sizeBefore + 2);

        mock.timers.setTime(1_000_000 + 5_001);
        await callTool("google_drive_search", { q: "sweep-c" }, options);
        assert.equal(
          failureMemoSize(),
          sizeBefore + 1,
          "expired sweep-a/sweep-b entries must be removed on the sweep-c write",
        );
      } finally {
        mock.timers.reset();
      }
    });
  });

  it("never memoizes login-required 401s", async () => {
    await withStubbedGate(401, { errorMessage: "login required" }, async (calls) => {
      const options = {
        connectorType: ConnectorType.GoogleDrive,
        token: fakeJwt({ sub: "memo-user-4", iat: 1000, exp: 2000 }),
      };
      const first = await callTool("google_drive_search", { q: "auth" }, options);
      const second = await callTool("google_drive_search", { q: "auth" }, options);
      assert.equal(first.ok, false);
      assert.equal(first.loginRequired, true);
      assert.equal(second.loginRequired, true);
      assert.equal(calls(), 2);
    });
  });
});

describe("callTool", () => {
  it("resolves ok:false for non-serializable args instead of rejecting", async () => {
    process.env.GROK_CONNECTORS_URL = "https://connectors.invalid.example";
    try {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = await callTool(
        "google_drive_search",
        circular as ToolArgs,
        {
          connectorType: ConnectorType.GoogleDrive,
          token: "opaque-token",
        },
      );
      assert.equal(result.ok, false);
      assert.match(result.errorMessage ?? "", /circular/i);
    } finally {
      delete process.env.GROK_CONNECTORS_URL;
    }
  });
});

describe("isLoginRequired", () => {
  it("is true only for login-required failures", () => {
    assert.equal(
      isLoginRequired({ ok: false, data: null, loginRequired: true }),
      true,
    );
    assert.equal(isLoginRequired({ ok: false, data: null }), false);
    assert.equal(
      isLoginRequired({ ok: false, data: null, errorMessage: "access_denied" }),
      false,
    );
    assert.equal(
      isLoginRequired({
        ok: true,
        data: {},
        loginRequired: true,
      } as CallToolResult),
      false,
    );
  });
});

describe("redirectToLoginIfRequired", () => {
  it("no-ops when login is not required", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          errorMessage: "tool error",
        }),
    );
    assert.equal(did, false);
    assert.equal(target, "");
  });

  it("navigates to the server-built loginUrl in the browser", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(target, "https://gate.grok.me/__gate/signin?return_to=x");
  });

  it("opens a new tab instead of navigating when framed", () => {
    let assigned = "";
    let opened = "";
    const openedTab: { opener?: unknown } = { opener: "parent" };
    const did = withWindow(
      {
        self: "frame",
        top: "host",
        open: (url) => {
          opened = url;
          return openedTab;
        },
        location: {
          assign: (u) => {
            assigned = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(opened, "https://gate.grok.me/__gate/signin?return_to=x");
    assert.equal(openedTab.opener, null);
    assert.equal(assigned, "");
  });

  it("falls back to navigation when framed and the popup is blocked", () => {
    let assigned = "";
    const did = withWindow(
      {
        self: "frame",
        top: "host",
        open: () => null,
        location: {
          assign: (u) => {
            assigned = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
        }),
    );
    assert.equal(did, true);
    assert.equal(assigned, "https://gate.grok.me/__gate/signin?return_to=x");
  });

  it("returns false when the result has no loginUrl", () => {
    let target = "";
    const did = withWindow(
      {
        location: {
          assign: (u) => {
            target = u;
          },
          href: "https://my-app.grok.me/current",
        },
      },
      () =>
        redirectToLoginIfRequired({ ok: false, data: null, loginRequired: true }),
    );
    assert.equal(did, false);
    assert.equal(target, "");
  });

  it("returns false on the server (no window)", () => {
    const did = redirectToLoginIfRequired({
      ok: false,
      data: null,
      loginRequired: true,
      loginUrl: "https://gate.grok.me/__gate/signin?return_to=x",
    });
    assert.equal(did, false);
  });
});

describe("classifyCallToolError", () => {
  it("returns null for successful results", () => {
    assert.equal(classifyCallToolError({ ok: true, data: {} }), null);
  });

  it("classifies login-required before message matching", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      loginRequired: true,
      errorMessage: "missing_connector_token",
    });
    assert.equal(state?.kind, "login");
    assert.equal(state?.detail, "missing_connector_token");
  });

  it("classifies not_connected and failed_precondition", () => {
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "connector_not_connected: Notion",
      })?.kind,
      "not_connected",
    );
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "FAILED_PRECONDITION: no connector",
      })?.kind,
      "not_connected",
    );
  });

  it("classifies scope_denied without claiming a missing grant", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      errorMessage: "scope_denied: tool notion-list-recent-pages not in grant scopes",
    });
    assert.equal(state?.kind, "scope_denied");
    assert.match(state?.message ?? "", /tool outside its grant/);
    assert.match(state?.detail ?? "", /notion-list-recent-pages/);
  });

  it("classifies access_denied", () => {
    assert.equal(
      classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: "access_denied",
      })?.kind,
      "access_denied",
    );
  });

  it("falls back to a generic error with the raw message", () => {
    const state = classifyCallToolError({
      ok: false,
      data: null,
      errorMessage: "boom",
    });
    assert.equal(state?.kind, "error");
    assert.equal(state?.message, "boom");
    const empty = classifyCallToolError({ ok: false, data: null });
    assert.equal(empty?.kind, "error");
    assert.equal(empty?.message, "Something went wrong. Try again.");
    assert.equal(empty?.detail, undefined);
  });
});
