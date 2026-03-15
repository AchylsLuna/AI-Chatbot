import crypto from "node:crypto";

export const hashSessionToken = (token) =>
    crypto.createHash("sha256").update(String(token || "")).digest("hex");
