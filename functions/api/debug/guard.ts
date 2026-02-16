async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestGet = async ({ request, env }: any) => {
  const expected = String(env.DEV_GUARD ?? "");
  const provided = request.headers.get("x-dev-guard") ?? "";
  return Response.json({
    hasEnv: Boolean(expected),
    envLen: expected.length,
    envHash: expected ? await sha256Hex(expected) : null,
    providedLen: provided.length,
    providedHash: provided ? await sha256Hex(provided) : null,
    match: expected === provided,
  });
};

export const onRequestGet = async ({ request, env }: any) => {
  const expected = String(env.DEV_GUARD ?? "");
  const provided = request.headers.get("x-dev-guard") ?? "";

  // Return only metadata + hashes (safe)
  return Response.json({
    hasEnv: Boolean(expected),
    envLen: expected.length,
    envHash: expected ? await sha256Hex(expected) : null,

    providedLen: provided.length,
    providedHash: provided ? await sha256Hex(provided) : null,

    match: expected === provided,
  });
};
