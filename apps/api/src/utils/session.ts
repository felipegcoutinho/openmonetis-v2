import { auth } from "../auth";

export function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
