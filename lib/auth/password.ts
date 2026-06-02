export type PasswordRuleStatus = {
  id: string;
  label: string;
  met: boolean;
};

const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (password: string) => password.length >= 12,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
  {
    id: "spaces",
    label: "No spaces",
    test: (password: string) => !/\s/.test(password),
  },
];

export function getPasswordRuleStatuses(password: string): PasswordRuleStatus[] {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
}

export function validateStrongPassword(password: string): {
  isValid: boolean;
  messages: string[];
} {
  const failedRules = getPasswordRuleStatuses(password).filter(
    (rule) => !rule.met,
  );

  return {
    isValid: failedRules.length === 0,
    messages: failedRules.map((rule) => rule.label),
  };
}
