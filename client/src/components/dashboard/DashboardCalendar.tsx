import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';
import { Card } from '@/components/ui/Page';
import type { Appointment } from '@/services/appointments.service';
import type { Visit } from '@/services/visits.service';
import { toIsoDate } from '@/utils/datetime';
import { useMemo } from 'react';

export type CalendarEventKind = 'appointment' | 'visit' | 'followup';

export interface CalendarSelection {
  date: string;
  time: string;
}

interface DashboardCalendarProps {
  appointments: Appointment[];
  visits: Visit[];
  showMrName?: boolean;
  onSelectSlot: (selection: CalendarSelection) => void;
  onEventClick: (kind: CalendarEventKind, id: number) => void;
  onAppointmentMove?: (id: number, date: string, time: string) => void;
}

function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export function DashboardCalendar({
  appointments,
  visits,
  showMrName = false,
  onSelectSlot,
  onEventClick,
  onAppointmentMove,
}: DashboardCalendarProps) {
  const events = useMemo<EventInput[]>(() => {
    const appointmentEvents: EventInput[] = appointments.map((item) => ({
      id: `appointment:${item.id}`,
      title: showMrName
        ? `📅 Appt: ${item.mr?.fullName ?? 'MR'} → ${item.doctor?.fullName ?? 'Dr'}`
        : `📅 Appt: ${item.doctor?.fullName ?? 'Doctor'}`,
      start: combineDateTime(item.date, item.time),
      backgroundColor: 'var(--color-primary-soft)',
      borderColor: 'var(--color-primary)',
      textColor: 'var(--color-ink)',
      editable: item.status === 'PENDING',
      extendedProps: { kind: 'appointment' as const, entityId: item.id },
    }));

    const visitEvents: EventInput[] = visits.map((item) => ({
      id: `visit:${item.id}`,
      title: showMrName
        ? `🩺 Visit: ${item.mr?.fullName ?? 'MR'} → ${item.doctor?.fullName ?? 'Dr'}`
        : `🩺 Visit: ${item.doctor?.fullName ?? 'Doctor'}`,
      start: combineDateTime(item.visitDate, item.visitTime ?? '09:00'),
      backgroundColor: 'rgba(37, 99, 235, 0.12)',
      borderColor: '#2563eb',
      textColor: 'var(--color-ink)',
      editable: false,
      extendedProps: { kind: 'visit' as const, entityId: item.id },
    }));

    const followUps: EventInput[] = visits
      .filter((item) => item.nextFollowUp)
      .map((item) => ({
        id: `followup:${item.id}`,
        title: `🔔 Follow-up: ${item.doctor?.fullName ?? 'Dr'}`,
        start: item.nextFollowUp!,
        allDay: true,
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderColor: '#d97706',
        textColor: 'var(--color-ink)',
        editable: false,
        extendedProps: { kind: 'followup' as const, entityId: item.id },
      }));

    return [...appointmentEvents, ...visitEvents, ...followUps];
  }, [appointments, visits, showMrName]);

  const apptCount = appointments.length;
  const visitCount = visits.length;
  const followUpCount = visits.filter((v) => v.nextFollowUp).length;

  return (
    <Card className="overflow-hidden p-4 md:p-6 shadow-sm border border-[var(--color-border)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            Appointments ({apptCount})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Visits ({visitCount})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Follow-ups ({followUpCount})
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)] italic hidden sm:block">
          💡 Click any date slot to schedule an appointment.
        </p>
      </div>

      <div className="fc-shell scrollbar-hide">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
          }}
          height="auto"
          selectable
          selectMirror
          editable
          eventStartEditable
          eventDurationEditable={false}
          events={events}
          select={(arg) => {
            const date = toIsoDate(arg.start);
            const hours = arg.allDay ? 10 : arg.start.getHours();
            const minutes = arg.allDay ? 0 : arg.start.getMinutes();
            const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            onSelectSlot({ date, time });
            arg.view.calendar.unselect();
          }}
          eventClick={(arg) => {
            const kind = arg.event.extendedProps.kind as CalendarEventKind;
            const entityId = Number(arg.event.extendedProps.entityId);
            onEventClick(kind, entityId);
          }}
          eventDrop={(arg) => {
            const kind = arg.event.extendedProps.kind as CalendarEventKind;
            if (kind !== 'appointment' || !onAppointmentMove) {
              arg.revert();
              return;
            }
            const start = arg.event.start;
            if (!start) {
              arg.revert();
              return;
            }
            onAppointmentMove(
              Number(arg.event.extendedProps.entityId),
              toIsoDate(start),
              `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
            );
          }}
          nowIndicator
          dayMaxEvents={3}
          handleWindowResize
        />
      </div>
    </Card>
  );
}
