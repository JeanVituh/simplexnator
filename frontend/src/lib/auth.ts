export interface FormErrors { [field: string]: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const MIN_PASSWORD = 8

export function validateLogin(email: string, password: string): FormErrors {
  const e: FormErrors = {}
  if (!EMAIL.test(email.trim())) e.email = 'Informe um e-mail válido.'
  if (!password) e.password = 'Informe a senha.'
  return e
}

export function validateRegister(f: { name: string; email: string; password: string; confirm: string }): FormErrors {
  const e: FormErrors = {}
  if (f.name.trim().length < 2) e.name = 'Informe seu nome.'
  if (!EMAIL.test(f.email.trim())) e.email = 'Informe um e-mail válido.'
  if (f.password.length < MIN_PASSWORD) e.password = `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (f.confirm !== f.password) e.confirm = 'A confirmação não confere com a senha.'
  return e
}

export const validateEmailOnly = (email: string): FormErrors => (EMAIL.test(email.trim()) ? {} : { email: 'Informe um e-mail válido.' })
