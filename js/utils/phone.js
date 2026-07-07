export function formatPhone(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length > 10) return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  if (digits.length > 6) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  if (digits.length > 2) return digits.replace(/(\d{2})(\d{0,5})/, "($1) $2").trim();
  return digits;
}
