interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-stone-100 md:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-stone-400">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
