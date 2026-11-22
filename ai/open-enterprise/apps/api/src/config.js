// Explicit configuration. Missing keys throw. Production refuses the local identity issuer.

export function loadConfig(env = process.env) {
  const releaseEnv = required(env, "RELEASE_ENV");
  if (releaseEnv !== "local" && releaseEnv !== "prod") {
    throw new Error("RELEASE_ENV must be local or prod");
  }

  const identityIssuer = required(env, "IDENTITY_ISSUER");
  if (identityIssuer !== "local" && identityIssuer !== "external") {
    throw new Error("IDENTITY_ISSUER must be local or external");
  }
  if (releaseEnv === "prod" && identityIssuer === "local") {
    throw new Error("local identity issuer is refused when RELEASE_ENV=prod");
  }

  const attachmentBackend = required(env, "ATTACHMENT_BACKEND");
  if (attachmentBackend !== "file") {
    throw new Error("ATTACHMENT_BACKEND must be the explicit value file");
  }

  const sessionSecret = required(env, "SESSION_SECRET");
  const serviceToken = required(env, "SERVICE_TOKEN");
  if (sessionSecret.length < 16 || serviceToken.length < 16) {
    throw new Error("SESSION_SECRET and SERVICE_TOKEN must each be at least 16 characters");
  }

  return {
    releaseEnv,
    identityIssuer,
    attachmentBackend,
    attachmentDir: required(env, "ATTACHMENT_DIR"),
    databaseUrl: required(env, "DATABASE_URL"),
    sessionSecret,
    serviceToken,
    apiPort: Number(env.API_PORT || 8080),
    agentHostUrl: emptyToNull(env.AGENT_HOST_URL),
  };
}

function required(env, name) {
  const value = env[name];
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`missing ${name}`);
  }
  return String(value).trim();
}

function emptyToNull(value) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}
