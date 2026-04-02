import "./ClientWorkspace.scss";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getServerUrl } from "../../lib/serverUrl";

function ClientWorkspace({ token, profile, mode = "messages" }) {
  const serverUrl = getServerUrl();
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [composer, setComposer] = useState({ subject: "", body: "", files: [] });
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState("");

  const authConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const isConsultant = String(profile?.type) === "0";

  const panelCopy = {
    clients: {
      eyebrow: isConsultant ? "Client management" : "Consultant directory",
      title: isConsultant ? "See every client at a glance" : "Your consultant relationships",
      empty: isConsultant
        ? "No clients yet. Accepted appointments will populate this list."
        : "No consultant relationships yet. Book a session to start one.",
    },
    messages: {
      eyebrow: "Emails and files",
      title: isConsultant ? "Send updates, files, and follow-ups" : "Review messages and reply with files",
      empty: "No conversations yet. Once an appointment exists, messages will appear here.",
    },
  };

  const copy = panelCopy[mode] || panelCopy.messages;

  const fetchContacts = async () => {
    try {
      setIsLoadingContacts(true);
      const { data } = await axios.get(`${serverUrl}/api/client-workspace/contacts`, authConfig);
      setContacts(data);
      if (data.length) {
        setSelectedContactId((current) => current || data[0].id);
      }
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load contacts.");
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchConversation = async (contactId) => {
    if (!contactId) {
      setConversation(null);
      setNoteText("");
      return;
    }

    try {
      setIsLoadingConversation(true);
      const { data } = await axios.get(
        `${serverUrl}/api/client-workspace/conversations/${contactId}`,
        authConfig
      );
      setConversation(data);
      setNoteText(data.noteText || "");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load conversation.");
    } finally {
      setIsLoadingConversation(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    fetchConversation(selectedContactId);
  }, [selectedContactId]);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;

  const handleFileChange = (event) => {
    setComposer((current) => ({
      ...current,
      files: Array.from(event.target.files || []),
    }));
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedContactId) {
      return;
    }

    setError("");
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.append("subject", composer.subject);
      formData.append("body", composer.body);
      composer.files.forEach((file) => {
        formData.append("attachments", file);
      });

      await axios.post(
        `${serverUrl}/api/client-workspace/conversations/${selectedContactId}/messages`,
        formData,
        {
          headers: {
            ...authConfig.headers,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setComposer({ subject: "", body: "", files: [] });
      await Promise.all([fetchContacts(), fetchConversation(selectedContactId)]);
    } catch (sendError) {
      console.error(sendError);
      setError(sendError?.response?.data?.error || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedContactId || !isConsultant) {
      return;
    }

    setError("");
    setIsSavingNote(true);
    try {
      await axios.patch(
        `${serverUrl}/api/client-workspace/contacts/${selectedContactId}/note`,
        { noteText },
        authConfig
      );
      await Promise.all([fetchContacts(), fetchConversation(selectedContactId)]);
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <section className="client-workspace">
      <div className="client-workspace__header">
        <div>
          <p className="client-workspace__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <button
          className="client-workspace__refresh"
          onClick={() => Promise.all([fetchContacts(), fetchConversation(selectedContactId)])}
        >
          Refresh
        </button>
      </div>

      <div className="client-workspace__layout">
        <aside className="client-workspace__sidebar">
          <h3>{isConsultant ? "Clients" : "Consultants"}</h3>
          {isLoadingContacts ? (
            <p className="client-workspace__empty">Loading contacts...</p>
          ) : contacts.length ? (
            <div className="client-workspace__contact-list">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  className={`client-workspace__contact ${selectedContactId === contact.id ? "client-workspace__contact--active" : ""}`}
                  onClick={() => setSelectedContactId(contact.id)}
                >
                  <strong>{contact.first_name} {contact.last_name}</strong>
                  <span>{contact.email}</span>
                  {mode === "messages" ? (
                    contact.latestMessageSubject ? (
                      <small>{contact.latestMessageSubject}</small>
                    ) : (
                      <small>No messages yet</small>
                    )
                  ) : (
                    <small>
                      {contact.noteText
                        ? "Private note saved"
                        : isConsultant
                          ? "No notes yet"
                          : "View shared activity"}
                    </small>
                  )}
                  {mode === "messages" && contact.unreadCount ? <em>{contact.unreadCount} new</em> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="client-workspace__empty">{copy.empty}</p>
          )}
        </aside>

        <div className="client-workspace__main">
          {selectedContact && conversation ? (
            <>
              <div className="client-workspace__thread-header">
                <div>
                  <h3>{selectedContact.first_name} {selectedContact.last_name}</h3>
                  <p>{selectedContact.email}</p>
                </div>
              </div>

              {mode === "clients" ? (
                <div className="client-workspace__client-card">
                  <div className="client-workspace__client-grid">
                    <article>
                      <span>Email</span>
                      <strong>{selectedContact.email}</strong>
                    </article>
                    <article>
                      <span>Unread messages</span>
                      <strong>{selectedContact.unreadCount || 0}</strong>
                    </article>
                    <article>
                      <span>Latest message</span>
                      <strong>{selectedContact.latestMessageSubject || "No message subject yet"}</strong>
                    </article>
                    <article>
                      <span>Last activity</span>
                      <strong>
                        {selectedContact.latestMessageAt
                          ? new Date(selectedContact.latestMessageAt).toLocaleString()
                          : "No activity yet"}
                      </strong>
                    </article>
                  </div>

                  {isConsultant ? (
                    <div className="client-workspace__note-card">
                      <div className="client-workspace__section-title">
                        <h4>Private consultant notes</h4>
                        <button onClick={handleSaveNote} disabled={isSavingNote}>
                          {isSavingNote ? "Saving..." : "Save note"}
                        </button>
                      </div>
                      <textarea
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                        placeholder="Store observations, follow-ups, and reminders for this client."
                      />
                    </div>
                  ) : (
                    <div className="client-workspace__client-summary">
                      <p>
                        This panel keeps the relationship view separate from your message inbox. Switch to
                        the Messages tab to read and send files.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="client-workspace__thread">
                  <div className="client-workspace__messages">
                    {isLoadingConversation ? (
                      <p className="client-workspace__empty">Loading conversation...</p>
                    ) : conversation.messages.length ? (
                      conversation.messages.map((message) => (
                        <article
                          key={message.id}
                          className={`client-workspace__message ${message.senderId === profile.id ? "client-workspace__message--outgoing" : "client-workspace__message--incoming"}`}
                        >
                          {message.subject ? <h4>{message.subject}</h4> : null}
                          <p>{message.body}</p>
                          {message.attachments?.length ? (
                            <div className="client-workspace__attachments">
                              {message.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={`${serverUrl}/api/client-workspace/attachments/${attachment.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {attachment.originalName}
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <small>{new Date(message.createdAt).toLocaleString()}</small>
                        </article>
                      ))
                    ) : (
                      <p className="client-workspace__empty">No messages yet. Start the conversation below.</p>
                    )}
                  </div>

                  <form className="client-workspace__composer" onSubmit={handleSendMessage}>
                    <div className="client-workspace__section-title">
                      <h4>New message</h4>
                    </div>
                    <input
                      type="text"
                      placeholder="Subject"
                      value={composer.subject}
                      onChange={(event) =>
                        setComposer((current) => ({ ...current, subject: event.target.value }))
                      }
                    />
                    <textarea
                      placeholder="Write your message"
                      value={composer.body}
                      onChange={(event) =>
                        setComposer((current) => ({ ...current, body: event.target.value }))
                      }
                      required
                    />
                    <label className="client-workspace__file-picker">
                      <span>Attachments</span>
                      <input type="file" multiple onChange={handleFileChange} />
                    </label>
                    {composer.files.length ? (
                      <ul className="client-workspace__file-list">
                        {composer.files.map((file) => (
                          <li key={`${file.name}-${file.size}`}>{file.name}</li>
                        ))}
                      </ul>
                    ) : null}
                    {error ? <p className="client-workspace__error">{error}</p> : null}
                    <button type="submit" disabled={isSending}>
                      {isSending ? "Sending..." : "Send message"}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="client-workspace__placeholder">
              <p>Select a contact to continue.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ClientWorkspace;
