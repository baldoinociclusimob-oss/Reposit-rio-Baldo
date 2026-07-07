export function formatCPF(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  let out = digits;
  if (digits.length > 9) out = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  else if (digits.length > 6) out = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  else if (digits.length > 3) out = `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return out;
}

/** Validação padrão do dígito verificador do CPF (checagem local, nada é enviado a lugar nenhum). */
export function isValidCPF(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  function checkDigit(base) {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(digits[i]) * (base - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  }

  return checkDigit(10) === Number(digits[9]) && checkDigit(11) === Number(digits[10]);
}
