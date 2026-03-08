import { AppointmentSlot, BookingStatus } from '@/data/booking-data';
import { cn } from '@/lib/utils';

const statusStyles: Record<BookingStatus, { border: string; dot: string }> = {
  confirmed: { border: 'border-l-clinical-safe', dot: 'bg-clinical-safe' },
  pending: { border: 'border-l-safety-yellow', dot: 'bg-safety-yellow' },
  completed: { border: 'border-l-muted-foreground', dot: 'bg-muted-foreground' },
  cancelled: { border: 'border-l-destructive', dot: 'bg-destructive' },
  'no-show': { border: 'border-l-destructive/50', dot: 'bg-destructive/50' },
};

interface Props {
  appointment: AppointmentSlot;
  onClick: () => void;
  compact?: boolean;
}

export function AppointmentCard({ appointment, onClick, compact }: Props) {
  const style = statusStyles[appointment.status];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left rounded-md border-l-[3px] bg-secondary/60 px-2 py-1.5',
          'hover:bg-secondary transition-colors cursor-pointer',
          style.border
        )}
      >
        <p className="text-[0.625rem] font-mono text-muted-foreground leading-tight">{appointment.time}</p>
        <p className="text-xs font-medium text-foreground leading-tight truncate">{appointment.patientName}</p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border-l-[3px] bg-card border border-border/60 px-3 py-2.5',
        'hover:shadow-card-hover hover:border-border transition-all cursor-pointer',
        style.border
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
        <span className="text-xs font-mono text-muted-foreground">{appointment.time} · {appointment.durationMinutes}min</span>
      </div>
      <p className="text-sm font-semibold text-foreground mt-1">{appointment.patientName}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{appointment.service}</p>
      <p className="text-xs text-muted-foreground">{appointment.pharmacistName}</p>
    </button>
  );
}
