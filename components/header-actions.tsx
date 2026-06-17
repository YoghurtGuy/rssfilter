"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { LogoutButton } from "./logout-button";

export function HeaderActions() {
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button variant="primary" onPress={() => router.push("/sources/new")}>
        新建源
      </Button>
      <LogoutButton />
    </div>
  );
}
