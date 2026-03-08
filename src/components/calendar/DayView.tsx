import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AppointmentSlot } from '@/data/booking-data';
import { AppointmentCard } from './AppointmentCard';
import { cn } from '@/lib/utils';

interface Props {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  appointments: AppointmentSlot[];
  onAppointmentClick: (apt: AppointmentSlot) => void;
}

const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

export function DayView({ selectedDate, onDateChange, appointments, onAppointmentClick }: Props) {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayAppts = appointments.filter(a => a.date === dateStr);

  return (
    <div className="flex gap-8 lg:gap-12">
      {/* Sidebar calendar */}
      <div className="w-[280px] shrink-0 hidden md:flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && onDateChange(d)}
            className={cn("p-0 pointer-events-auto w-full [&_table]:w-full")}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-lg font-medium"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''} today
        </p>
      </div>

      {/* Time grid */}
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          {/* Day header */}
          <div className="px-6 py-4 border-b border-border bg-secondary/40">
            <h2 className="text-lg font-semibold text-foreground">{format(selectedDate, 'EEEE, d MMMM yyyy')}</h2>
          </div>

          {/* Time rows */}
          <div className="divide-y divide-border/40">
            {TIME_SLOTS.map(slot => {
              const slotAppts = dayAppts.filter(a => a.time === slot);
              const isHour = slot.endsWith(':00');
              return (
                <div
                  key={slot}
                  className={cn(
                    'flex min-h-[3.5rem] transition-colors hover:bg-secondary/20',
                    isHour && 'bg-secondary/10'
                  )}
                >
                  <div className="w-20 shrink-0 flex items-start justify-end pr-4 pt-3">
                    <span className={cn(
                      'text-xs font-mono',
                      isHour ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}>
                      {slot}
                    </span>
                  </div>
                  <div className="flex-1 border-l border-border/40 px-4 py-2 space-y-1.5">
                    {slotAppts.map(a => (
                      <AppointmentCard key={a.id} appointment={a} onClick={() => onAppointmentClick(a)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
