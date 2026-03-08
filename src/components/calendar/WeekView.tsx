import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppointmentSlot } from '@/data/booking-data';
import { AppointmentCard } from './AppointmentCard';
import { cn } from '@/lib/utils';

interface Props {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  appointments: AppointmentSlot[];
  onAppointmentClick: (apt: AppointmentSlot) => void;
}

export function WeekView({ selectedDate, onDateChange, appointments, onAppointmentClick }: Props) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* Week header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/40">
        <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => onDateChange(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold text-foreground">
          {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}
        </span>
        <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => onDateChange(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 divide-x divide-border/40">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayAppts = appointments.filter(a => a.date === dateStr);
          const isToday = isSameDay(day, new Date());
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[14rem] flex flex-col',
                isWeekend && 'bg-muted/30'
              )}
            >
              {/* Day header */}
              <div className={cn(
                'text-center py-3 border-b border-border/40',
                isToday && 'bg-primary/5'
              )}>
                <div className="text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-wide">
                  {format(day, 'EEE')}
                </div>
                <div className={cn(
                  'mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Appointments */}
              <div className="flex-1 p-2 space-y-1.5">
                {dayAppts.map(a => (
                  <AppointmentCard key={a.id} appointment={a} onClick={() => onAppointmentClick(a)} compact />
                ))}
                {dayAppts.length === 0 && (
                  <p className="text-[0.625rem] text-muted-foreground/50 text-center pt-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
