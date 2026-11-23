// Disposable localhost OIDC provider. Never connects to Google or sends mail.
import { createServer } from "node:http";
import { randomUUID, generateKeyPairSync, createHash, sign } from "node:crypto";
const issuer = "http://127.0.0.1:3161";
if (
  process.env.DYNO ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test") ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Disposable loopback database required.");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  alg: "RS256",
  use: "sig",
  kid: "local-auth-test",
};
const requests = new Map(),
  codes = new Map();
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (claims) => {
  const body = `${encode({ alg: "RS256", kid: jwk.kid })}.${encode(claims)}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, issuer);
  const json = (value, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/.well-known/openid-configuration")
    return json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      code_challenge_methods_supported: ["S256"],
    });
  if (url.pathname === "/jwks") return json({ keys: [jwk] });
  if (url.pathname === "/health") return json({ ok: true });
  if (url.pathname === "/authorize") {
    const request = Object.fromEntries(url.searchParams);
    if (
      request.redirect_uri !==
        "http://localhost:3100/api/auth/callback/google" ||
      !request.code_challenge ||
      !request.nonce ||
      !request.state
    )
      return json({ error: "invalid_request" }, 400);
    const id = randomUUID();
    requests.set(id, request);
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(
      `<h1>Local Google test provider</h1><form action="/approve"><input type="hidden" name="request" value="${id}"><label>Email<input name="email" type="email" required></label><label>Subject<input name="subject" required></label><label><input name="unverified" type="checkbox">Unverified email</label><label><input name="badNonce" type="checkbox">Wrong nonce</label><button>Confirm test identity</button><button name="cancel" value="yes">Cancel</button></form>`,
    );
  }
  if (url.pathname === "/approve") {
    const request = requests.get(url.searchParams.get("request"));
    if (!request) return json({ error: "expired_request" }, 400);
    requests.delete(url.searchParams.get("request"));
    const target = new URL(request.redirect_uri);
    target.searchParams.set("state", request.state);
    if (url.searchParams.has("cancel"))
      target.searchParams.set("error", "access_denied");
    else {
      const code = randomUUID();
      codes.set(code, {
        ...request,
        email: url.searchParams.get("email"),
        sub: url.searchParams.get("subject"),
        email_verified: !url.searchParams.has("unverified"),
        badNonce: url.searchParams.has("badNonce"),
      });
      target.searchParams.set("code", code);
    }
    res.writeHead(302, { Location: target.toString() });
    return res.end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = new URLSearchParams(raw),
      entry = codes.get(body.get("code"));
    codes.delete(body.get("code"));
    if (
      !entry ||
      body.get("redirect_uri") !== entry.redirect_uri ||
      createHash("sha256")
        .update(body.get("code_verifier") ?? "")
        .digest("base64url") !== entry.code_challenge
    )
      return json({ error: "invalid_grant" }, 400);
    const now = Math.floor(Date.now() / 1000);
    return json({
      access_token: "local-fixture-only",
      token_type: "Bearer",
      expires_in: 3600,
      id_token: jwt({
        iss: issuer,
        aud: entry.client_id,
        sub: entry.sub,
        email: entry.email,
        email_verified: entry.email_verified,
        nonce: entry.badNonce ? "wrong-nonce" : entry.nonce,
        iat: now,
        exp: now + 300,
      }),
    });
  }
  json({ error: "not_found" }, 404);
});
server.listen(3161, "127.0.0.1");
