import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors HomePage's real card layout (hero balance, brief, bills, savings,
 * recent transactions) so the swap from skeleton to real content doesn't
 * cause any layout jump — every block below is sized to roughly match what
 * it's standing in for. Shown only while there is no data yet at all; once
 * the first load completes, refetches no longer show this (see useAppData).
 */
export function HomeSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-5 pb-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>

      <div className="px-4 pt-3 flex flex-col gap-3.5 pb-4">
        <Card>
          <Skeleton className="h-3 w-32 mb-2.5" />
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="pt-3.5 border-t border-border">
            <Skeleton className="h-3 w-24 mb-2.5" />
            <Skeleton className="h-6 w-32" />
          </div>
        </Card>

        <Card>
          <Skeleton className="h-4 w-28 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </Card>

        <Card>
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-10 w-full" />
        </Card>

        <Card>
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <Skeleton className="h-4 w-40 mb-3" />
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    </div>
  );
}
