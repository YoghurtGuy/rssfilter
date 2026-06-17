"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <Button size="sm" variant="ghost" onPress={logout}>
      退出登录
    </Button>
  );
}
