import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { supabase } from "../../lib/supabase";

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type Appointment = {
  id: string;
  public_token: string;
  service_id: string | null;
  staff_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "smart_link" | "admin";
  notes: string | null;
  created_at: string;
};

type AppointmentService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
};

type AppointmentStaff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  sort_order: number;
};

type AppointmentResponse = {
  business_id: string;
  appointments: Appointment[];
  services: AppointmentService[];
  staff: AppointmentStaff[];
};

const DAY_LABELS = [
  "Δευ",
  "Τρι",
  "Τετ",
  "Πεμ",
  "Παρ",
  "Σαβ",
  "Κυρ",
];

const STATUS_LABELS: Record<
  AppointmentStatus,
  string
> = {
  pending: "Αναμονή",
  confirmed: "Επιβεβαιωμένο",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
  no_show: "Δεν εμφανίστηκε",
};

export function AppointmentsTab({
  businessId,
}: {
  businessId?: string | null;
}) {
  const [selectedDate, setSelectedDate] =
    useState(() => new Date());
  const [appointments, setAppointments] =
    useState<Appointment[]>([]);
  const [services, setServices] =
    useState<AppointmentService[]>([]);
  const [staff, setStaff] =
    useState<AppointmentStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const weekStart = useMemo(
    () =>
      startOfWeek(selectedDate, {
        weekStartsOn: 1,
      }),
    [selectedDate],
  );

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        addDays(weekStart, index),
      ),
    [weekStart],
  );

  const dayAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        isSameDay(
          new Date(appointment.starts_at),
          selectedDate,
        ),
      ),
    [appointments, selectedDate],
  );

  const weekAppointments = useMemo(
    () =>
      [...appointments].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime(),
      ),
    [appointments],
  );

  const todayCount = appointments.filter(
    (appointment) =>
      isSameDay(
        new Date(appointment.starts_at),
        new Date(),
      ) &&
      appointment.status !== "cancelled",
  ).length;

  const weekCount = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled",
  ).length;

  const nextAppointment =
    appointments.find(
      (appointment) =>
        new Date(appointment.starts_at) >
          new Date() &&
        appointment.status !== "cancelled",
    ) ?? null;

  async function loadAppointments() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.hash = "/login";
        return;
      }

      const rangeStart =
        startOfWeek(selectedDate, {
          weekStartsOn: 1,
        });
      const rangeEnd = addDays(rangeStart, 7);

      const params = new URLSearchParams({
        view: "appointments",
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      });

      if (businessId) {
        params.set("business_id", businessId);
      }

      const response = await fetch(
        `/api/analytics?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as
          | AppointmentResponse
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "Δεν ήταν δυνατή η φόρτωση των ραντεβού.",
        );
      }

      const data = result as AppointmentResponse;
      setAppointments(data.appointments ?? []);
      setServices(
        (data.services ?? []).filter(
          (item) => item.is_active,
        ),
      );
      setStaff(
        (data.staff ?? []).filter(
          (item) => item.is_active,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Δεν ήταν δυνατή η φόρτωση των ραντεβού.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAppointments();
  }, [
    businessId,
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate(),
  ]);

  async function updateStatus(
    appointment: Appointment,
    status: AppointmentStatus,
  ) {
    const previous = appointments;

    setAppointments((current) =>
      current.map((item) =>
        item.id === appointment.id
          ? { ...item, status }
          : item,
      ),
    );

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.hash = "/login";
        return;
      }

      const params = new URLSearchParams({
        view: "appointments",
      });

      if (businessId) {
        params.set("business_id", businessId);
      }

      const response = await fetch(
        `/api/analytics?${params.toString()}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: appointment.id,
            status,
          }),
        },
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ||
            "Δεν αποθηκεύτηκε η αλλαγή.",
        );
      }
    } catch (statusError) {
      console.error(statusError);
      setAppointments(previous);
    }
  }

  return (
    <section>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
          Appointments
        </p>
        <h1 className="mt-4 text-[11vw] font-black leading-[0.9] tracking-[-0.05em] sm:text-[7vw] lg:text-[4.6vw]">
          Το πρόγραμμά σου.
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-[#222]/50">
          Τα ραντεβού δημιουργούνται από τους πελάτες μέσω του Smart Link και εμφανίζονται αυτόματα εδώ.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <AppointmentMetric
          label="Σήμερα"
          value={String(todayCount)}
          note="ενεργά ραντεβού"
        />
        <AppointmentMetric
          label="Αυτή την εβδομάδα"
          value={String(weekCount)}
          note="σύνολο ραντεβού"
        />
        <AppointmentMetric
          label="Επόμενο"
          value={
            nextAppointment
              ? format(
                  new Date(
                    nextAppointment.starts_at,
                  ),
                  "HH:mm",
                )
              : "—"
          }
          note={
            nextAppointment?.customer_name ??
            "δεν υπάρχει επόμενο"
          }
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-black/10 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-black/8 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(selectedDate, -7),
              )
            }
            className="grid h-10 w-10 place-items-center rounded-full border border-black/10 transition hover:bg-[#F6F6F4]"
          >
            ←
          </button>

          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
              Εβδομάδα
            </p>
            <p className="mt-1 text-sm font-black">
              {format(weekStart, "dd/MM")} —{" "}
              {format(
                addDays(weekStart, 6),
                "dd/MM/yyyy",
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedDate(
                addDays(selectedDate, 7),
              )
            }
            className="grid h-10 w-10 place-items-center rounded-full border border-black/10 transition hover:bg-[#F6F6F4]"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-black/8">
          {weekDays.map((day, index) => {
            const selected =
              isSameDay(day, selectedDate);
            const count =
              appointments.filter(
                (appointment) =>
                  isSameDay(
                    new Date(
                      appointment.starts_at,
                    ),
                    day,
                  ) &&
                  appointment.status !==
                    "cancelled",
              ).length;

            const hasAppointments =
              count > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() =>
                  setSelectedDate(day)
                }
                className={`relative min-h-[98px] px-1 py-4 text-center transition sm:px-3 ${
                  hasAppointments
                    ? "bg-[#DC2727] text-white hover:bg-[#c91f1f]"
                    : selected
                      ? "bg-[#222] text-white"
                      : "hover:bg-[#F6F6F4]"
                } ${
                  selected &&
                  hasAppointments
                    ? "ring-2 ring-inset ring-[#222]"
                    : ""
                }`}
              >
                <p
                  className={`text-[8px] font-bold uppercase tracking-[0.12em] ${
                    hasAppointments ||
                    selected
                      ? "text-white/55"
                      : "text-[#222]/35"
                  }`}
                >
                  {DAY_LABELS[index]}
                </p>

                <p className="mt-2 text-lg font-black">
                  {format(day, "d")}
                </p>

                {hasAppointments && (
                  <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.12em] text-white/70">
                    {count}{" "}
                    {count === 1
                      ? "ραντεβού"
                      : "ραντεβού"}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#DC2727]">
                {DAY_LABELS[
                  (selectedDate.getDay() + 6) %
                    7
                ]}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {format(
                  selectedDate,
                  "dd/MM/yyyy",
                )}
              </h2>
            </div>

            <span className="rounded-full bg-[#F6F6F4] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#222]/45">
              {dayAppointments.length} ραντεβού
            </span>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-[#222]/40">
              Φόρτωση ραντεβού...
            </p>
          ) : error ? (
            <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : dayAppointments.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-xl font-black">
                Ελεύθερη ημέρα.
              </p>
              <p className="mt-2 text-sm text-[#222]/40">
                Δεν υπάρχουν ραντεβού για αυτή την ημέρα.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {dayAppointments.map(
                (appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    service={services.find(
                      (service) =>
                        service.id ===
                        appointment.service_id,
                    )}
                    staffMember={staff.find(
                      (member) =>
                        member.id ===
                        appointment.staff_id,
                    )}
                    onStatusChange={(status) =>
                      updateStatus(
                        appointment,
                        status,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-black/10 bg-white">
        <div className="flex flex-col gap-3 border-b border-black/8 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#DC2727]">
              Πρόγραμμα εβδομάδας
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
              Όλα τα ραντεβού
            </h2>
          </div>

          <span className="w-fit rounded-full bg-[#222] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            {weekAppointments.length} συνολικά
          </span>
        </div>

        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-[#222]/40">
            Φόρτωση προγράμματος...
          </p>
        ) : error ? (
          <p className="m-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 sm:m-6">
            {error}
          </p>
        ) : weekAppointments.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-xl font-black">
              Καμία κράτηση αυτή την εβδομάδα.
            </p>
            <p className="mt-2 text-sm text-[#222]/40">
              Τα νέα ραντεβού από το Smart Link θα εμφανίζονται εδώ αυτόματα.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/8">
            {weekDays.map((day, index) => {
              const items =
                weekAppointments.filter(
                  (appointment) =>
                    isSameDay(
                      new Date(
                        appointment.starts_at,
                      ),
                      day,
                    ),
                );

              if (items.length === 0) {
                return null;
              }

              return (
                <section
                  key={day.toISOString()}
                  className="px-5 py-5 sm:px-6"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate(day)
                    }
                    className="mb-4 flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#DC2727]">
                        {DAY_LABELS[index]}
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {format(
                          day,
                          "dd/MM/yyyy",
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F6F6F4] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#222]/45">
                      {items.length}{" "}
                      {items.length === 1
                        ? "ραντεβού"
                        : "ραντεβού"}
                    </span>
                  </button>

                  <div className="grid gap-3">
                    {items.map(
                      (appointment) => (
                        <AppointmentRow
                          key={appointment.id}
                          appointment={
                            appointment
                          }
                          service={services.find(
                            (service) =>
                              service.id ===
                              appointment.service_id,
                          )}
                          staffMember={staff.find(
                            (member) =>
                              member.id ===
                              appointment.staff_id,
                          )}
                          onStatusChange={(
                            status,
                          ) =>
                            updateStatus(
                              appointment,
                              status,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AppointmentMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[18px] border border-black/10 bg-white p-5">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#222]/35">
        {note}
      </p>
    </div>
  );
}

function AppointmentRow({
  appointment,
  service,
  staffMember,
  onStatusChange,
}: {
  appointment: Appointment;
  service?: AppointmentService;
  staffMember?: AppointmentStaff;
  onStatusChange: (
    status: AppointmentStatus,
  ) => void;
}) {
  return (
    <article className="grid gap-4 rounded-[18px] border border-black/8 bg-[#F6F6F4] p-4 sm:grid-cols-[90px_1fr_auto] sm:items-center">
      <div>
        <p className="text-xl font-black">
          {format(
            new Date(appointment.starts_at),
            "HH:mm",
          )}
        </p>
        <p className="mt-1 text-[10px] text-[#222]/35">
          έως{" "}
          {format(
            new Date(appointment.ends_at),
            "HH:mm",
          )}
        </p>
      </div>

      <div>
        <p className="text-sm font-black">
          {appointment.customer_name}
        </p>
        <p className="mt-1 text-[11px] text-[#222]/45">
          {service?.name ?? "Ραντεβού"}
          {staffMember
            ? ` · ${staffMember.name}`
            : ""}
        </p>
        {(appointment.customer_phone ||
          appointment.notes) && (
          <p className="mt-2 text-[10px] text-[#222]/35">
            {appointment.customer_phone}
            {appointment.customer_phone &&
            appointment.notes
              ? " · "
              : ""}
            {appointment.notes}
          </p>
        )}
      </div>

      <select
        value={appointment.status}
        onChange={(event) =>
          onStatusChange(
            event.target.value as AppointmentStatus,
          )
        }
        className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[10px] font-bold outline-none"
      >
        {(
          Object.keys(
            STATUS_LABELS,
          ) as AppointmentStatus[]
        ).map((status) => (
          <option
            key={status}
            value={status}
          >
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </article>
  );
}
