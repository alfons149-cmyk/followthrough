export async function getAuthContext(
  request: Request,
  env: Record<string, unknown>
): Promise<AuthContext> {
  const expected = String(env.DEV_GUARD ?? "").trim();
  if (!expected) {
    return { ok: false, status: 500, message: "Missing DEV_GUARD secret in env." };
  }

  const provided = (request.headers.get("x-dev-guard") ?? "").trim();

  if (provided !== expected) {
    return { ok: false, status: 401, message: "Unauthorized: bad x-dev-guard." };
  }

  return { ok: true };
}
