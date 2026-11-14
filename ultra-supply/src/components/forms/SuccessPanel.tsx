import { CheckCircle2 } from 'lucide-react';

export function SuccessPanel({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-start border border-navy/10 bg-mist p-8 sm:p-12">
      <span className="flex h-14 w-14 items-center justify-center bg-navy text-white">
        <CheckCircle2 className="h-7 w-7" strokeWidth={1.5} />
      </span>
      <h3 className="display-md mt-8 text-navy">{title}</h3>
      <p className="mt-4 max-w-lg text-[16px] text-navy-950/70">{text}</p>
      <button type="button" onClick={onAction} className="btn btn-ghost mt-8">{action}</button>
    </div>
  );
}
