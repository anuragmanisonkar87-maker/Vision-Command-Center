import type { ReactNode } from "react";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import type { ActionKey } from "@/services/accessControl/effectiveAccessService";
import { AccessDenied } from "./AccessDenied";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  moduleKey: string;
  action?: ActionKey;
  label?: string;
  children: ReactNode;
};

export function ModuleGuard({ moduleKey, action = "view", label, children }: Props) {
  const { isLoading, canPerform } = useEffectiveAccess();

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!canPerform(moduleKey, action)) {
    return <AccessDenied moduleLabel={label ?? moduleKey} />;
  }

  return <>{children}</>;
}
