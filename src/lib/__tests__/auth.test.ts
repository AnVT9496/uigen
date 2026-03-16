// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeValidToken(payload: Record<string, unknown> = {}) {
  return new SignJWT({ userId: "user-1", email: "test@example.com", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } = await import(
  "../auth"
);

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, , options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
  });

  it("sets secure:false outside production", async () => {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  it("sets expiry ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expiry = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiry).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiry).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it("stores a JWT containing userId and email", async () => {
    await createSession("user-1", "test@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];

    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not-a-valid-jwt" });
    expect(await getSession()).toBeNull();
  });

  it("returns the session payload for a valid token", async () => {
    const token = await makeValidToken();
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user-1");
    expect(session!.email).toBe("test@example.com");
  });
});

describe("deleteSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  it("returns null when no cookie on the request", async () => {
    const req = new NextRequest("http://localhost");
    expect(await verifySession(req)).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    const req = new NextRequest("http://localhost", {
      headers: { cookie: "auth-token=bad-token" },
    });
    expect(await verifySession(req)).toBeNull();
  });

  it("returns session payload for a valid token", async () => {
    const token = await makeValidToken();
    const req = new NextRequest("http://localhost", {
      headers: { cookie: `auth-token=${token}` },
    });

    const session = await verifySession(req);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user-1");
    expect(session!.email).toBe("test@example.com");
  });
});
