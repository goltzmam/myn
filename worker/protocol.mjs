import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
export function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return (
    body + "." + createHmac("sha256", secret).update(body).digest("base64url")
  );
}
export function verify(token, secret, now = Date.now()) {
  const [body, signature, extra] = (token || "").split(".");
  if (!body || !signature || extra) throw new Error("Invalid authorization");
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(expected, supplied)
  )
    throw new Error("Invalid authorization");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (
    !Number.isFinite(payload.expires) ||
    payload.expires < now ||
    payload.expires > now + 35000 ||
    typeof payload.nonce !== "string"
  )
    throw new Error("Authorization expired");
  if (
    !Array.isArray(payload.domains) ||
    payload.domains.length > 8 ||
    !payload.taskId ||
    !payload.userId ||
    !payload.sessionId
  )
    throw new Error("Invalid scope");
  return payload;
}
export function publicAddress(ip) {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return !(
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && (p[1] === 168 || p[1] === 0)) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && [18, 19].includes(p[1]))
    );
  }
  if (isIP(ip) === 6) return false; // IPv6 is disabled in the initial executor, including mapped IPv4 and link-local ranges.
  return false;
}
export function validateDestination(raw, domains, testOrigin) {
  const url = new URL(raw);
  if (testOrigin && url.origin === testOrigin) return url;
  if (
    [...url.searchParams.keys()].some((key) =>
      /password|secret|access_token|api_key/i.test(key),
    )
  )
    throw new Error("Sensitive URL values are not accepted");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    !domains.includes(url.hostname)
  )
    throw new Error("Destination is outside approved domains");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(url.hostname))
    throw new Error("Private destination blocked");
  return url;
}
export function safeText(text) {
  return String(text)
    .replace(
      /(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9_.-]{10,}|eyJ[A-Za-z0-9_.-]{30,})/g,
      "[redacted]",
    )
    .slice(0, 10000);
}
