import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl flex flex-col items-center justify-center text-center px-8 py-16 bg-white border border-dashed border-border">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5 bg-[#F8F4E6] text-[#B69D66]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
