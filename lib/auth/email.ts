const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;

const RESERVED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "localhost",
]);

const RESERVED_TLDS = new Set(["example", "invalid", "localhost", "test"]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonaddy.com",
  "anonymbox.com",
  "byom.de",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "moakt.com",
  "mytemp.email",
  "sharklasers.com",
  "spam4.me",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

function getEmailParts(email: string) {
  const [local, domain, ...extraParts] = email.split("@");

  if (!local || !domain || extraParts.length > 0) {
    return null;
  }

  return {
    local,
    domain,
  };
}

function isLikelyEmailSyntax(email: string) {
  if (email.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(email)) return false;

  const parts = getEmailParts(email);
  if (!parts) return false;

  const { local, domain } = parts;
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return false;
  }
  if (!domain.includes(".")) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;

  const labels = domain.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  ) {
    return false;
  }

  const tld = labels[labels.length - 1];
  return /^[A-Za-z]{2,63}$/.test(tld);
}

function isDisposableDomain(domain: string) {
  return Array.from(DISPOSABLE_EMAIL_DOMAINS).some(
    (blockedDomain) =>
      domain === blockedDomain || domain.endsWith(`.${blockedDomain}`),
  );
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateRegistrationEmail(email: string): {
  isValid: boolean;
  message?: string;
} {
  const normalizedEmail = normalizeEmail(email);
  const parts = getEmailParts(normalizedEmail);

  if (!normalizedEmail) {
    return { isValid: false, message: "Email is required." };
  }

  if (!isLikelyEmailSyntax(normalizedEmail) || !parts) {
    return { isValid: false, message: "Enter a valid email address." };
  }

  const domain = parts.domain;
  const domainLabels = domain.split(".");
  const tld = domainLabels[domainLabels.length - 1] ?? "";

  if (RESERVED_EMAIL_DOMAINS.has(domain) || RESERVED_TLDS.has(tld)) {
    return {
      isValid: false,
      message: "Use a real email address that can receive verification email.",
    };
  }

  if (isDisposableDomain(domain)) {
    return {
      isValid: false,
      message: "Disposable email addresses are not allowed.",
    };
  }

  return { isValid: true };
}
