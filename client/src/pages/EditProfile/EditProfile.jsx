import "./EditProfile.scss";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getServerUrl } from "../../lib/serverUrl";

function EditProfile({ token, handleLogout, onProfileUpdated }) {
  const navigate = useNavigate();
  const serverUrl = getServerUrl();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    email: "",
    password: "",
    confirmPassword: "",
    type: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${serverUrl}/api/user/current`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setForm((current) => ({
          ...current,
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
          address: data.address || "",
          email: data.email || "",
          type: String(data.type),
        }));
        setIsLoading(false);
      } catch (fetchError) {
        handleLogout();
      }
    };

    fetchProfile();
  }, [handleLogout, serverUrl, token]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password && form.password !== form.confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setIsSaving(true);

    try {
      const { data } = await axios.patch(
        `${serverUrl}/api/user/current`,
        {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          address: form.address,
          email: form.email,
          password: form.password || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (onProfileUpdated) {
        onProfileUpdated(data);
      }

      setSuccess("Profile updated.");
      setForm((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    } catch (saveError) {
      setError(saveError?.response?.data?.error || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <main className="edit-profile"><p className="edit-profile__loading">Loading profile...</p></main>;
  }

  return (
    <main className="edit-profile">
      <section className="edit-profile__hero">
        <p className="edit-profile__eyebrow">Profile settings</p>
        <h1>Edit your account details</h1>
        <p>
          Update your contact details, keep your email current, and set a new password when needed.
        </p>
      </section>

      <form className="edit-profile__card" onSubmit={handleSubmit}>
        <div className="edit-profile__grid">
          <label className="edit-profile__field">
            <span>First name</span>
            <input name="first_name" value={form.first_name} onChange={handleChange} />
          </label>

          <label className="edit-profile__field">
            <span>Last name</span>
            <input name="last_name" value={form.last_name} onChange={handleChange} />
          </label>

          <label className="edit-profile__field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} />
          </label>

          <label className="edit-profile__field">
            <span>Phone</span>
            <input name="phone" value={form.phone} onChange={handleChange} />
          </label>

          <label className="edit-profile__field edit-profile__field--full">
            <span>Address</span>
            <input name="address" value={form.address} onChange={handleChange} />
          </label>

          <label className="edit-profile__field">
            <span>Role</span>
            <input
              value={form.type === "1" ? "Client" : "Consultant"}
              disabled
              readOnly
            />
          </label>

          <label className="edit-profile__field">
            <span>New password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
            />
          </label>

          <label className="edit-profile__field">
            <span>Confirm new password</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
            />
          </label>
        </div>

        {error ? <p className="edit-profile__message edit-profile__message--error">{error}</p> : null}
        {success ? <p className="edit-profile__message edit-profile__message--success">{success}</p> : null}

        <div className="edit-profile__actions">
          <button type="button" className="edit-profile__secondary" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
          <button type="submit" className="edit-profile__primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default EditProfile;
