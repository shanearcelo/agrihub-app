// src/app/auth/role-select.tsx
import { Redirect } from "expo-router";

export default function RoleSelectRedirect() {
  return <Redirect href="/auth/login" />;
}
