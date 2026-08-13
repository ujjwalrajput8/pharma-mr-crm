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
        ? `Appt · ${item.mr?.fullName ?? 'MR'} · ${item.doctor?.fullName ?? 'Doctor'}`
        : `Appt · ${item.doctor?.fullName ?? 'Doctor'}`,
      start: combineDateTime(item.date, item.time),
      backgroundColor: 'var(--color-cal-appointment)',
      borderColor: 'var(--color-cal-appointment)',
      editable: item.status === 'PENDING',
      extendedProps: { kind: 'appointment' as const, entityId: item.id },
    }));

    const visitEvents: EventInput[] = visits.map((item) => ({
      id: `visit:${item.id}`,
      title: showMrName
        ? `Visit · ${item.mr?.fullName ?? 'MR'} · ${item.doctor?.fullName ?? 'Doctor'}`
        : `Visit · ${item.doctor?.fullName ?? 'Doctor'}`,
      start: combineDateTime(item.visitDate, item.visitTime ?? '09:00'),
      backgroundColor: 'var(--color-cal-visit)',
      borderColor: 'var(--color-cal-visit)',
      editable: false,
      extendedProps: { kind: 'visit' as const, entityId: item.id },
    }));

    const followUps: EventInput[] = visits
      .filter((item) => item.nextFollowUp)
      .map((item) => ({
        id: `followup:${item.id}`,
        title: `Follow-up · ${item.doctor?.fullName ?? 'Doctor'}`,
        start: item.nextFollowUp!,
        allDay: true,
        backgroundColor: 'var(--color-cal-followup)',
        borderColor: 'var(--color-cal-followup)',
        editable: false,
        extendedProps: { kind: 'followup' as const, entityId: item.id },
      }));

    return [...appointmentEvents, ...visitEvents, ...followUps];
  }, [appointments, visits, showMrName]);

  return (
    <Card className="overflow-hidden p-3 md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-cal-appointment)]" /> Appointment
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-cal-visit)]" /> Visit
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-cal-followup)]" /> Follow-up
        </span>
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
