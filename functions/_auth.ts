// functions/_auth.ts

export type AuthContext =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getAuthContext(
  request: Request,
  env: Record<string, unknown>
): Promise<AuthContext> {
  const expected = String(env.DEV_GUARD ?? "");
  if (!expected) {
    return { ok: false, status: 500, message: "Missing DEV_GUARD secret in env." };
  }

  const provided = request.headers.get("x-dev-guard") ?? "";
  if (provided !== expected) {
    return { ok: false, status: 401, message: "Unauthorized: bad x-dev-guard." };
  }

  return { ok: true };
}
