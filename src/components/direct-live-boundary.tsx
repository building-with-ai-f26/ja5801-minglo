"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectContext } from "./direct-readers";

import { directContextVersion } from "@/lib/direct-context";
const Context = createContext<{
  update: (c: DirectContext) => void;
  end: () => void;
} | null>(null);
export const useDirectLive = () => useContext(Context);
export function DirectLiveBoundary({
  version,
  children,
}: {
  version: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const update = useCallback(
    (c: DirectContext) => {
      if (directContextVersion(c) !== version) {
        router.refresh();
      }
    },
    [router, version],
  );
  const end = useCallback(() => {
    setStatus("Access ended. Return to Messages or sign in again.");
    router.refresh();
  }, [router]);
  return (
    <Context.Provider value={{ update, end }}>
      {status ? (
        <p className="card" role="status">
          {status}
        </p>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
