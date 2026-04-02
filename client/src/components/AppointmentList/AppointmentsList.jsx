import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import "./AppointmentsList.scss";
import { getServerUrl } from "../../lib/serverUrl";

const VIEW_OPTIONS = ["day", "week", "month"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = Array.from({ length: 13 }, (_, index) => 8 + index);

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeek = (date) => {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
};

const endOfWeek = (date) => addDays(startOfWeek(date), 6);

const startOfMonthGrid = (date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(next);
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isWithinRange = (date, start, end) => date >= start && date <= end;

const formatHeroDate = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatRangeLabel = (view, currentDate) => {
  if (view === "day") {
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  if (view === "week") {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const getStatusTone = (status) => {
  switch (status) {
    case "accepted":
      return "accepted";
    case "requested":
      return "requested";
    case "canceled":
      return "canceled";
    default:
      return "neutral";
  }
};

const AppointmentsList = ({ token }) => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redirecting, setRedirecting] = useState({ state: false, appointmentId: 0 });
  const [currentView, setCurrentView] = useState("week");
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const serverUrl = getServerUrl();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${serverUrl}/api/appointments/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setAppointments(response.data);
      setSelectedAppointmentId((current) => current || response.data[0]?.appointmentId || null);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizedAppointments = useMemo(
    () =>
      appointments
        .map((appointment) => {
          const start = new Date(appointment.appointmentDateTime);
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            ...appointment,
            start,
            end,
          };
        })
        .sort((left, right) => left.start - right.start),
    [appointments]
  );

  useEffect(() => {
    if (!normalizedAppointments.length) {
      setSelectedAppointmentId(null);
      return;
    }

    const exists = normalizedAppointments.some(
      (appointment) => appointment.appointmentId === selectedAppointmentId
    );
    if (!exists) {
      setSelectedAppointmentId(normalizedAppointments[0].appointmentId);
    }
  }, [normalizedAppointments, selectedAppointmentId]);

  const selectedAppointment =
    normalizedAppointments.find(
      (appointment) => appointment.appointmentId === selectedAppointmentId
    ) || null;

  const visibleRange = useMemo(() => {
    if (currentView === "day") {
      const day = startOfDay(currentDate);
      return { start: day, end: addDays(day, 1) };
    }

    if (currentView === "week") {
      const start = startOfWeek(currentDate);
      return { start, end: addDays(start, 7) };
    }

    const start = startOfMonthGrid(currentDate);
    return { start, end: addDays(start, 42) };
  }, [currentDate, currentView]);

  const visibleAppointments = useMemo(
    () =>
      normalizedAppointments.filter(
        (appointment) =>
          appointment.start >= visibleRange.start && appointment.start < visibleRange.end
      ),
    [normalizedAppointments, visibleRange]
  );

  const dailyAppointments = useMemo(() => {
    const start = startOfDay(currentDate);
    const end = addDays(start, 1);
    return normalizedAppointments.filter(
      (appointment) => appointment.start >= start && appointment.start < end
    );
  }, [currentDate, normalizedAppointments]);

  const moveRange = (direction) => {
    const next = new Date(currentDate);
    if (currentView === "day") {
      next.setDate(next.getDate() + direction);
    } else if (currentView === "week") {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setMonth(next.getMonth() + direction);
    }
    setCurrentDate(startOfDay(next));
  };

  const handleDelete = async (appointmentId) => {
    try {
      await axios.delete(`${serverUrl}/api/appointments/${appointmentId}/delete`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchAppointments();
    } catch (error) {
      console.error("Error deleting appointment:", error?.response?.data || error);
    }
  };

  const joinAppointment = (appointmentId) => {
    setRedirecting({ state: true, appointmentId });
  };

  const handleAccept = async (appointmentId) => {
    try {
      await axios.patch(
        `${serverUrl}/api/appointments/${appointmentId}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchAppointments();
    } catch (error) {
      console.error("Error accepting appointment:", error?.response?.data || error);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      await axios.patch(
        `${serverUrl}/api/appointments/${appointmentId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchAppointments();
    } catch (error) {
      console.error("Error canceling appointment:", error?.response?.data || error);
    }
  };

  const renderAppointmentActions = (appointment) => (
    <div className="appointment-calendar__actions">
      {appointment.appointmentStatus === "requested" ? (
        <>
          <button
            className="appointment-calendar__action appointment-calendar__action--accept"
            onClick={() => handleAccept(appointment.appointmentId)}
          >
            Accept
          </button>
          <button
            className="appointment-calendar__action appointment-calendar__action--cancel"
            onClick={() => handleCancel(appointment.appointmentId)}
          >
            Cancel
          </button>
        </>
      ) : null}

      {appointment.appointmentStatus === "accepted" ? (
        <>
          <button
            className="appointment-calendar__action appointment-calendar__action--join"
            onClick={() => joinAppointment(appointment.appointmentId)}
          >
            Join session
          </button>
          <button
            className="appointment-calendar__action appointment-calendar__action--cancel"
            onClick={() => handleCancel(appointment.appointmentId)}
          >
            Cancel
          </button>
        </>
      ) : null}

      {appointment.appointmentStatus === "canceled" ? (
        <>
          <button
            className="appointment-calendar__action appointment-calendar__action--delete"
            onClick={() => handleDelete(appointment.appointmentId)}
          >
            Delete
          </button>
          <button
            className="appointment-calendar__action appointment-calendar__action--accept"
            onClick={() => handleAccept(appointment.appointmentId)}
          >
            Restore
          </button>
        </>
      ) : null}
    </div>
  );

  const renderMonthView = () => {
    const start = startOfMonthGrid(currentDate);
    const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

    return (
      <div className="appointment-calendar__month">
        <div className="appointment-calendar__weekday-row">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="appointment-calendar__month-grid">
          {days.map((day) => {
            const dayAppointments = normalizedAppointments.filter((appointment) =>
              isSameDay(appointment.start, day)
            );

            return (
              <button
                key={day.toISOString()}
                type="button"
                className={`appointment-calendar__month-cell ${
                  day.getMonth() !== currentDate.getMonth()
                    ? "appointment-calendar__month-cell--muted"
                    : ""
                } ${isSameDay(day, currentDate) ? "appointment-calendar__month-cell--current" : ""}`}
                onClick={() => setCurrentDate(startOfDay(day))}
              >
                <strong>{day.getDate()}</strong>
                <div className="appointment-calendar__month-items">
                  {dayAppointments.slice(0, 3).map((appointment) => (
                    <span
                      key={appointment.appointmentId}
                      className={`appointment-calendar__month-item appointment-calendar__month-item--${getStatusTone(
                        appointment.appointmentStatus
                      )}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedAppointmentId(appointment.appointmentId);
                      }}
                    >
                      {appointment.start.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      {appointment.clientFirstName}
                    </span>
                  ))}
                  {dayAppointments.length > 3 ? (
                    <small>+{dayAppointments.length - 3} more</small>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekOrDayColumns = () => {
    const start = currentView === "day" ? startOfDay(currentDate) : startOfWeek(currentDate);
    const dayCount = currentView === "day" ? 1 : 7;
    const columns = Array.from({ length: dayCount }, (_, index) => addDays(start, index));

    return (
      <div
        className={`appointment-calendar__timeboard appointment-calendar__timeboard--${currentView}`}
      >
        <div className="appointment-calendar__timeboard-header">
          <div className="appointment-calendar__time-label-spacer"></div>
          {columns.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              className={`appointment-calendar__timeboard-day ${
                isSameDay(day, currentDate) ? "appointment-calendar__timeboard-day--current" : ""
              }`}
              onClick={() => setCurrentDate(startOfDay(day))}
            >
              <span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <strong>{day.getDate()}</strong>
            </button>
          ))}
        </div>

        <div className="appointment-calendar__timeboard-grid">
          <div className="appointment-calendar__time-labels">
            {TIME_SLOTS.map((hour) => (
              <span key={hour}>{hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}</span>
            ))}
          </div>

          {columns.map((day) => {
            const dayAppointments = normalizedAppointments.filter((appointment) =>
              isSameDay(appointment.start, day)
            );

            return (
              <div key={day.toISOString()} className="appointment-calendar__day-column">
                {TIME_SLOTS.map((hour) => (
                  <div key={`${day.toISOString()}-${hour}`} className="appointment-calendar__slot"></div>
                ))}
                {dayAppointments.map((appointment) => {
                  const startHour = appointment.start.getHours() + appointment.start.getMinutes() / 60;
                  const durationHours = Math.max(
                    (appointment.end.getTime() - appointment.start.getTime()) / (60 * 60 * 1000),
                    0.75
                  );
                  const top = ((startHour - 8) / TIME_SLOTS.length) * 100;
                  const height = (durationHours / TIME_SLOTS.length) * 100;

                  return (
                    <button
                      key={appointment.appointmentId}
                      type="button"
                      className={`appointment-calendar__event appointment-calendar__event--${getStatusTone(
                        appointment.appointmentStatus
                      )} ${
                        appointment.appointmentId === selectedAppointmentId
                          ? "appointment-calendar__event--selected"
                          : ""
                      }`}
                      style={{
                        top: `${Math.max(top, 0)}%`,
                        height: `${Math.max(height, 7)}%`,
                      }}
                      onClick={() => setSelectedAppointmentId(appointment.appointmentId)}
                    >
                      <strong>{appointment.clientFirstName} {appointment.clientLastName}</strong>
                      <span>
                        {appointment.start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (redirecting.state) {
    return (
      <Navigate
        to="/meeting"
        replace
        state={{ appointmentId: redirecting.appointmentId, type: "service", token }}
      />
    );
  }

  if (isLoading) {
    return (
      <section className="appointment-calendar appointment-calendar--loading">
        <div className="appointment-calendar__toolbar">
          <div className="appointments-skeleton appointments-skeleton--toolbar"></div>
          <div className="appointments-skeleton appointments-skeleton--toolbar"></div>
        </div>
        <div className="appointments-skeleton appointments-skeleton--frame"></div>
      </section>
    );
  }

  return (
    <section className="appointment-calendar">
      <header className="appointment-calendar__header">
        <div>
          <p className="appointment-calendar__eyebrow">Calendar workspace</p>
          <h2 className="appointments-title">Meetings</h2>
          <p className="appointment-calendar__subtitle">
            Review requests, move through your day, and jump into sessions from a proper scheduling view.
          </p>
        </div>
        <button className="appointment-calendar__refresh" onClick={fetchAppointments}>
          Refresh
        </button>
      </header>

      <div className="appointment-calendar__toolbar">
        <div className="appointment-calendar__nav">
          <button type="button" onClick={() => moveRange(-1)}>
            Prev
          </button>
          <button type="button" onClick={() => setCurrentDate(startOfDay(new Date()))}>
            Today
          </button>
          <button type="button" onClick={() => moveRange(1)}>
            Next
          </button>
        </div>
        <strong className="appointment-calendar__range">
          {formatRangeLabel(currentView, currentDate)}
        </strong>
        <div className="appointment-calendar__views">
          {VIEW_OPTIONS.map((view) => (
            <button
              key={view}
              type="button"
              className={currentView === view ? "appointment-calendar__view--active" : ""}
              onClick={() => setCurrentView(view)}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {normalizedAppointments.length ? (
        <div className="appointment-calendar__body">
          <div className="appointment-calendar__board">
            {currentView === "month" ? renderMonthView() : renderWeekOrDayColumns()}
          </div>

          <aside className="appointment-calendar__sidebar">
            <div className="appointment-calendar__sidebar-card">
              <p className="appointment-calendar__sidebar-label">Selected day</p>
              <h3>
                {currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <ul className="appointment-calendar__agenda">
                {dailyAppointments.length ? (
                  dailyAppointments.map((appointment) => (
                    <li key={appointment.appointmentId}>
                      <button
                        type="button"
                        className={`appointment-calendar__agenda-item ${
                          appointment.appointmentId === selectedAppointmentId
                            ? "appointment-calendar__agenda-item--active"
                            : ""
                        }`}
                        onClick={() => setSelectedAppointmentId(appointment.appointmentId)}
                      >
                        <strong>
                          {appointment.start.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </strong>
                        <span>
                          {appointment.clientFirstName} {appointment.clientLastName}
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="appointment-calendar__agenda-empty">
                    No meetings scheduled for this date.
                  </li>
                )}
              </ul>
            </div>

            {selectedAppointment ? (
              <div className="appointment-calendar__sidebar-card appointment-calendar__sidebar-card--detail">
                <p className="appointment-calendar__sidebar-label">Selected meeting</p>
                <h3>
                  {selectedAppointment.clientFirstName} {selectedAppointment.clientLastName}
                </h3>
                <p className="appointment-calendar__detail-time">
                  {formatHeroDate(selectedAppointment.start)}
                </p>
                <span
                  className={`appointment-calendar__status appointment-calendar__status--${getStatusTone(
                    selectedAppointment.appointmentStatus
                  )}`}
                >
                  {selectedAppointment.appointmentStatus}
                </span>
                {renderAppointmentActions(selectedAppointment)}
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <p className="no-appointments">No appointments to show.</p>
      )}
    </section>
  );
};

export default AppointmentsList;
