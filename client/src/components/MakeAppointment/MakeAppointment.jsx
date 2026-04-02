import React, { useMemo, useState } from "react";
import axios from "axios";
import "./MakeAppointment.scss";
import { getServerUrl } from "../../lib/serverUrl";

const QUICK_TIMES = [
  "09:00",
  "10:30",
  "12:00",
  "14:00",
  "15:30",
  "17:00",
];

function formatDateLabel(value) {
  if (!value) {
    return "Pick a date";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function buildDateTime(date, time) {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}`;
}

const MakeAppointment = ({ consultants, token, onAppointmentMade }) => {
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const serverUrl = getServerUrl();

  const selectedConsultant = useMemo(
    () => consultants.find((consultant) => String(consultant.id) === String(selectedConsultantId)) || null,
    [consultants, selectedConsultantId]
  );

  const requestAppointment = async (payload) => {
    try {
      setIsLoading(true);
      setMessage("");
      await axios.post(`${serverUrl}/api/user/appointments/book`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessage("Appointment requested.");
      onAppointmentMade(payload);
      setSelectedDate("");
      setSelectedTime("");
    } catch (error) {
      console.error(error);
      setMessage("Could not request the appointment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const dateTime = buildDateTime(selectedDate, selectedTime);
    if (!selectedConsultantId || !dateTime) {
      setMessage("Choose a consultant, date, and time.");
      return;
    }

    requestAppointment({
      consultantId: selectedConsultantId,
      dateTime,
    });
  };

  if (!consultants || isLoading && consultants.length === 0) {
    return <p>Loading ...</p>;
  }

  return (
    <section className="make-appointment">
      <div className="make-appointment__header">
        <div>
          <p className="make-appointment__eyebrow">Consultant directory</p>
          <h2 className="make-appointment__title">Choose a consultant and lock in a session</h2>
          <p className="make-appointment__subtitle">
            Browse consultant cards, review their contact details, then schedule a session from the booking pane.
          </p>
        </div>
      </div>

      <div className="make-appointment__layout">
        <div className="make-appointment__consultants">
          {consultants.map((consultant) => {
            const isSelected = String(consultant.id) === String(selectedConsultantId);
            const initials = `${consultant.first_name?.[0] || ""}${consultant.last_name?.[0] || ""}`.toUpperCase();

            return (
              <button
                key={consultant.id}
                type="button"
                className={`make-appointment__consultant-card ${isSelected ? "make-appointment__consultant-card--active" : ""}`}
                onClick={() => setSelectedConsultantId(consultant.id)}
              >
                <div className="make-appointment__consultant-top">
                  <span className="make-appointment__avatar">{initials || "C"}</span>
                  <div>
                    <h3>{consultant.first_name} {consultant.last_name}</h3>
                    <p>Consultant</p>
                  </div>
                </div>

                <div className="make-appointment__consultant-meta">
                  <span>{consultant.email || "No email on file"}</span>
                  <span>{consultant.phone || "No phone on file"}</span>
                  <small>{consultant.address || "Address not added yet"}</small>
                </div>
              </button>
            );
          })}
        </div>

        <form className="make-appointment__scheduler" onSubmit={handleSubmit}>
          <div className="make-appointment__scheduler-head">
            <p className="make-appointment__scheduler-label">Selected consultant</p>
            <h3>
              {selectedConsultant
                ? `${selectedConsultant.first_name} ${selectedConsultant.last_name}`
                : "Choose a consultant"}
            </h3>
            <span>{selectedConsultant?.email || "Their contact details will appear here."}</span>
          </div>

          <label className="make-appointment__field">
            <span>Date</span>
            <input
              className="make-appointment__input"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <div className="make-appointment__time-picker">
            <div className="make-appointment__time-copy">
              <span>Suggested times</span>
              <strong>{formatDateLabel(selectedDate)}</strong>
            </div>
            <div className="make-appointment__time-grid">
              {QUICK_TIMES.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`make-appointment__time-slot ${selectedTime === time ? "make-appointment__time-slot--active" : ""}`}
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <label className="make-appointment__field">
            <span>Custom time</span>
            <input
              className="make-appointment__input"
              type="time"
              value={selectedTime}
              onChange={(event) => setSelectedTime(event.target.value)}
            />
          </label>

          <div className="make-appointment__summary">
            <span>Session summary</span>
            <strong>
              {selectedConsultant && selectedDate && selectedTime
                ? `${selectedConsultant.first_name} ${selectedConsultant.last_name} on ${formatDateLabel(selectedDate)} at ${selectedTime}`
                : "Select a consultant, date, and time to preview the booking."}
            </strong>
          </div>

          {message ? <p className="make-appointment__message">{message}</p> : null}

          <button type="submit" className="make-appointment__button" disabled={isLoading}>
            {isLoading ? "Booking..." : "Request appointment"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default MakeAppointment;
