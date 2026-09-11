"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { formatDisplayDate } from "@/lib/utils/display-date";
import { CalendarX2 } from "lucide-react";
import { reportClientError } from "@/lib/client-report-error";

import { useCalendar } from "@/calendar/contexts/calendar-context";
import { AgendaEventCard } from "@/calendar/components/agenda-view/agenda-event-card";
import { ScrollArea } from "@/components/ui/(calender)/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/(calender)/accordion";

import type { IEvent } from "@/calendar/interfaces";

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
}

type DayFetchState = {
  events: IEvent[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
};

function splitEventsForDay(events: IEvent[], day: Date) {
  const singleDayEvents: IEvent[] = [];
  const multiDayEvents: IEvent[] = [];

  for (const event of events) {
    const startDate = parseISO(event.startDate);
    const endDate = parseISO(event.endDate);

    if (isSameDay(startDate, endDate)) {
      singleDayEvents.push(event);
      continue;
    }

    if (day >= startOfDay(startDate) && day <= endOfDay(endDate)) {
      multiDayEvents.push(event);
    }
  }

  return { singleDayEvents, multiDayEvents };
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function CalendarAgendaView({ singleDayEvents, multiDayEvents }: IProps) {
  const { selectedDate, selectedUserId } = useCalendar();
  const monthStart = useMemo(() => startOfMonth(selectedDate), [selectedDate]);
  const monthEnd = useMemo(() => endOfMonth(selectedDate), [selectedDate]);

  const eventDays = useMemo(() => {
    const dayMap = new Map<string, Date>();

    const registerDate = (date: Date) => {
      if (date < monthStart || date > monthEnd) return;
      const key = format(date, "yyyy-MM-dd");
      if (!dayMap.has(key)) dayMap.set(key, startOfDay(date));
    };

    for (const event of singleDayEvents) {
      registerDate(parseISO(event.startDate));
    }

    for (const event of multiDayEvents) {
      const startDate = startOfDay(parseISO(event.startDate));
      const endDate = endOfDay(parseISO(event.endDate));

      let cursor = new Date(startDate);
      while (cursor <= endDate) {
        registerDate(new Date(cursor));
        cursor = new Date(cursor.setDate(cursor.getDate() + 1));
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => b.getTime() - a.getTime());
  }, [monthStart, monthEnd, multiDayEvents, singleDayEvents]);

  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [dayCache, setDayCache] = useState<Record<string, DayFetchState>>({});

  useEffect(() => {
    setOpenKeys([]);
    setDayCache({});
  }, [monthStart.getTime(), selectedUserId]);

  useEffect(() => {
    if (eventDays.length === 0) return;

    setOpenKeys((current) => {
      if (current.length > 0) return current;
      return [format(eventDays[0], "yyyy-MM-dd")];
    });
  }, [eventDays]);

  const fetchDayEvents = useCallback(async (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    setDayCache((prev) => ({
      ...prev,
      [key]: {
        events: prev[key]?.events ?? [],
        loading: true,
        error: null,
        loaded: prev[key]?.loaded ?? false,
      },
    }));

    try {
      const params = new URLSearchParams({ date: key });
      const res = await fetch(`/api/admin/calendar-events?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load events for ${key}`);
      }

      const data = await res.json();
      const fetchedEvents: IEvent[] = (data.events ?? []).filter((event: IEvent) => {
        if (selectedUserId === "all") return true;
        return event.user.id === selectedUserId;
      });

      setDayCache((prev) => ({
        ...prev,
        [key]: {
          events: fetchedEvents,
          loading: false,
          error: null,
          loaded: true,
        },
      }));
    } catch (error) {
      reportClientError(error, { feature: "admin-calendar-agenda" });
      setDayCache((prev) => ({
        ...prev,
        [key]: {
          events: prev[key]?.events ?? [],
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load events",
          loaded: false,
        },
      }));
    }
  }, [selectedUserId]);

  useEffect(() => {
    openKeys.forEach((key) => {
      const existing = dayCache[key];
      if (existing?.loaded || existing?.loading) return;
      const date = new Date(`${key}T00:00:00`);
      void fetchDayEvents(date);
    });
  }, [openKeys, dayCache, fetchDayEvents]);

  const handleOpenChange = (value: string | string[]) => {
    const next = Array.isArray(value) ? value : value ? [value] : [];
    setOpenKeys(next);
  };

  const hasLoadedAnyEvents = Object.values(dayCache).some((item) => item.loaded && item.events.length > 0);

  return (
    <div className="h-200">
      <ScrollArea className="h-full" type="always">
        <div className="space-y-4 p-4">

          <Accordion type="multiple" className="w-full space-y-1" onValueChange={handleOpenChange} value={openKeys}>
            {eventDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayState = dayCache[key];
              const loadedEvents = dayState?.events ?? [];
              const { singleDayEvents, multiDayEvents } = splitEventsForDay(loadedEvents, day);
              const isLoaded = dayState?.loaded ?? false;
              const isLoading = dayState?.loading ?? false;

              return (
                <AccordionItem key={key} value={key} className="rounded-xl border px-4">
                  <AccordionTrigger className="py-4 no-underline hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <div>
                        <p className="text-sm font-semibold">{formatDisplayDate(day)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isLoading
                            ? "Loading from database..."
                            : isLoaded
                              ? `${singleDayEvents.length + multiDayEvents.length} event(s) loaded`
                              : "Click to load events from database"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isLoaded && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {singleDayEvents.length + multiDayEvents.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-0">
                    <div className="space-y-2 pb-1">
                      {isLoading && (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                          <CalendarX2 className="size-4" />
                          Loading events for this date...
                        </div>
                      )}

                      {dayState?.error && (
                        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
                          {dayState.error}
                        </div>
                      )}

                      {isLoaded && singleDayEvents.length === 0 && multiDayEvents.length === 0 && !isLoading && (
                        <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                          No events scheduled for this date.
                        </div>
                      )}

                      {multiDayEvents.length > 0 &&
                        multiDayEvents.map((event) => {
                          const eventStart = parseISO(event.startDate);
                          const eventEnd = parseISO(event.endDate);
                          const eventCurrentDay = Math.max(1, Math.floor((startOfDay(day).getTime() - startOfDay(eventStart).getTime()) / 86400000) + 1);
                          const eventTotalDays = Math.max(1, Math.floor((startOfDay(eventEnd).getTime() - startOfDay(eventStart).getTime()) / 86400000) + 1);

                          return (
                            <AgendaEventCard
                              key={`${key}-${event.id}`}
                              event={event}
                              eventCurrentDay={eventCurrentDay}
                              eventTotalDays={eventTotalDays}
                            />
                          );
                        })}

                      {singleDayEvents.map((event) => (
                        <AgendaEventCard key={`${key}-${event.id}`} event={event} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {!hasLoadedAnyEvents && eventDays.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <CalendarX2 className="size-10" />
              <p className="text-sm md:text-base">Select a date above to load its events.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
