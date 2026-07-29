/**
 * The administrator the setup project creates, and every specification that
 * needs one signs in as.
 *
 * It lives here rather than in the setup file because Playwright refuses to let
 * one test file import another — they would be collected twice — and the setup
 * file is a test file.
 */
export const ADMINISTRATOR = {
  email: 'e2e-operator@sobremesa.es',
  password: 'Str0ng!Passw0rd',
};
