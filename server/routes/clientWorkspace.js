const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const knex = require("knex")(require("../knexfile"));

const uploadDir = path.join(__dirname, "..", "uploads", "client-workspace");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

async function authorize(req, res, next) {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).send("Authorization token is required");
  }

  try {
    const token = authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await knex("users")
      .select("id", "first_name", "last_name", "email", "type")
      .where({ id: payload.id })
      .first();

    if (!user) {
      return res.status(404).send("User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(400).send("Invalid token");
  }
}

async function getAuthorizedPair(currentUser, contactId) {
  const parsedContactId = Number(contactId);
  if (!parsedContactId) {
    return null;
  }

  const currentIsClient = String(currentUser.type) === "1";
  const pair = await knex("appointments")
    .join("users as consultant", "appointments.consultant_id", "consultant.id")
    .join("users as client", "appointments.client_id", "client.id")
    .where((builder) => {
      if (currentIsClient) {
        builder.where({
          "appointments.client_id": currentUser.id,
          "appointments.consultant_id": parsedContactId,
        });
      } else {
        builder.where({
          "appointments.consultant_id": currentUser.id,
          "appointments.client_id": parsedContactId,
        });
      }
    })
    .select(
      "consultant.id as consultantId",
      "consultant.first_name as consultantFirstName",
      "consultant.last_name as consultantLastName",
      "consultant.email as consultantEmail",
      "client.id as clientId",
      "client.first_name as clientFirstName",
      "client.last_name as clientLastName",
      "client.email as clientEmail"
    )
    .first();

  return pair || null;
}

function groupContacts(appointments, currentUser) {
  const currentIsClient = String(currentUser.type) === "1";
  const map = new Map();

  appointments.forEach((appointment) => {
    const contactId = currentIsClient ? appointment.consultantId : appointment.clientId;
    if (!map.has(contactId)) {
      map.set(contactId, {
        id: contactId,
        first_name: currentIsClient
          ? appointment.consultantFirstName
          : appointment.clientFirstName,
        last_name: currentIsClient
          ? appointment.consultantLastName
          : appointment.clientLastName,
        email: currentIsClient ? appointment.consultantEmail : appointment.clientEmail,
        role: currentIsClient ? "consultant" : "client",
        latestAppointmentAt: appointment.appointmentDateTime,
      });
    }
  });

  return Array.from(map.values());
}

/**
 * @swagger
 * /api/client-workspace/contacts:
 *   get:
 *     summary: List the current user's client or consultant contacts
 *     tags: [Client Workspace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contacts list with unread counts
 */
router.get("/contacts", authorize, async (req, res) => {
  try {
    const field =
      String(req.user.type) === "1"
        ? "appointments.client_id"
        : "appointments.consultant_id";

    const appointments = await knex("appointments")
      .join("users as consultant", "appointments.consultant_id", "=", "consultant.id")
      .join("users as client", "appointments.client_id", "=", "client.id")
      .where({ [field]: req.user.id })
      .select(
        "consultant.id as consultantId",
        "consultant.first_name as consultantFirstName",
        "consultant.last_name as consultantLastName",
        "consultant.email as consultantEmail",
        "client.id as clientId",
        "client.first_name as clientFirstName",
        "client.last_name as clientLastName",
        "client.email as clientEmail",
        "appointments.date_time as appointmentDateTime"
      )
      .orderBy("appointments.date_time", "desc");

    const contacts = groupContacts(appointments, req.user);

    const messageRows = await knex("client_messages")
      .where((builder) => {
        if (String(req.user.type) === "1") {
          builder.where("client_id", req.user.id);
        } else {
          builder.where("consultant_id", req.user.id);
        }
      })
      .select(
        "id",
        "consultant_id as consultantId",
        "client_id as clientId",
        "sender_id as senderId",
        "recipient_id as recipientId",
        "subject",
        "body",
        "is_read as isRead",
        "created_at as createdAt"
      )
      .orderBy("created_at", "desc");

    const notes = String(req.user.type) === "0"
      ? await knex("client_notes")
          .where({ consultant_id: req.user.id })
          .select("client_id as clientId", "note_text as noteText", "updated_at as updatedAt")
      : [];

    const noteMap = new Map(notes.map((note) => [note.clientId, note]));
    const messageMap = new Map();

    messageRows.forEach((message) => {
      const key = String(req.user.type) === "1" ? message.consultantId : message.clientId;
      if (!messageMap.has(key)) {
        messageMap.set(key, {
          latestMessageAt: message.createdAt,
          latestMessageSubject: message.subject || "",
          unreadCount: 0,
          latestMessageSenderId: message.senderId,
          latestMessageIsRead: Boolean(message.isRead),
        });
      }

      const current = messageMap.get(key);
      if (!current.latestMessageAt || new Date(message.createdAt) > new Date(current.latestMessageAt)) {
        current.latestMessageAt = message.createdAt;
        current.latestMessageSubject = message.subject || "";
        current.latestMessageSenderId = message.senderId;
        current.latestMessageIsRead = Boolean(message.isRead);
      }
      if (message.recipientId === req.user.id && !message.isRead) {
        current.unreadCount += 1;
      }
    });

    const enrichedContacts = contacts.map((contact) => ({
      ...contact,
      latestMessageAt: messageMap.get(contact.id)?.latestMessageAt || null,
      latestMessageSubject: messageMap.get(contact.id)?.latestMessageSubject || "",
      unreadCount: messageMap.get(contact.id)?.unreadCount || 0,
      latestMessageSenderId: messageMap.get(contact.id)?.latestMessageSenderId || null,
      latestMessageIsRead: messageMap.get(contact.id)?.latestMessageIsRead || false,
      noteText: noteMap.get(contact.id)?.noteText || "",
      noteUpdatedAt: noteMap.get(contact.id)?.updatedAt || null,
    }));

    res.json(enrichedContacts);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});

/**
 * @swagger
 * /api/client-workspace/conversations/{contactId}:
 *   get:
 *     summary: Get the conversation thread with a contact
 *     tags: [Client Workspace]
 *     security:
 *       - bearerAuth: []
 */
router.get("/conversations/:contactId", authorize, async (req, res) => {
  try {
    const pair = await getAuthorizedPair(req.user, req.params.contactId);
    if (!pair) {
      return res.status(404).send("Contact not found");
    }

    await knex("client_messages")
      .where({
        consultant_id: pair.consultantId,
        client_id: pair.clientId,
        recipient_id: req.user.id,
        is_read: false,
      })
      .update({ is_read: true });

    const messages = await knex("client_messages")
      .where({
        consultant_id: pair.consultantId,
        client_id: pair.clientId,
      })
      .orderBy("created_at", "asc");

    const attachments = await knex("client_message_attachments")
      .whereIn("message_id", messages.map((message) => message.id || 0))
      .select(
        "id",
        "message_id as messageId",
        "original_name as originalName",
        "mime_type as mimeType",
        "size"
      );

    const attachmentsByMessageId = attachments.reduce((accumulator, attachment) => {
      if (!accumulator[attachment.messageId]) {
        accumulator[attachment.messageId] = [];
      }
      accumulator[attachment.messageId].push(attachment);
      return accumulator;
    }, {});

    const note =
      String(req.user.type) === "0"
        ? await knex("client_notes")
            .where({
              consultant_id: pair.consultantId,
              client_id: pair.clientId,
            })
            .first()
        : null;

    res.json({
      contact: {
        id: String(req.user.type) === "1" ? pair.consultantId : pair.clientId,
        first_name:
          String(req.user.type) === "1" ? pair.consultantFirstName : pair.clientFirstName,
        last_name:
          String(req.user.type) === "1" ? pair.consultantLastName : pair.clientLastName,
        email: String(req.user.type) === "1" ? pair.consultantEmail : pair.clientEmail,
      },
      noteText: note?.note_text || "",
      messages: messages.map((message) => ({
        id: message.id,
        subject: message.subject,
        body: message.body,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        createdAt: message.created_at,
        isRead: Boolean(message.is_read),
        attachments: attachmentsByMessageId[message.id] || [],
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});

router.post(
  "/conversations/:contactId/messages",
  authorize,
  upload.array("attachments", 5),
  async (req, res) => {
    try {
      const pair = await getAuthorizedPair(req.user, req.params.contactId);
      if (!pair) {
        return res.status(404).send("Contact not found");
      }

      const body = req.body.body?.trim();
      const subject = req.body.subject?.trim() || "";
      if (!body) {
        return res.status(400).json({ error: "Message body is required." });
      }

      const recipientId = String(req.user.type) === "1" ? pair.consultantId : pair.clientId;
      const [messageId] = await knex("client_messages").insert({
        consultant_id: pair.consultantId,
        client_id: pair.clientId,
        sender_id: req.user.id,
        recipient_id: recipientId,
        subject,
        body,
      });

      if (req.files?.length) {
        await knex("client_message_attachments").insert(
          req.files.map((file) => ({
            message_id: messageId,
            original_name: file.originalname,
            stored_name: file.filename,
            mime_type: file.mimetype,
            size: file.size,
            file_path: file.path,
          }))
        );
      }

      res.status(201).json({ id: messageId });
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error occurred");
    }
  }
);

router.patch("/contacts/:contactId/note", authorize, async (req, res) => {
  if (String(req.user.type) !== "0") {
    return res.status(403).send("Only consultants can save notes.");
  }

  try {
    const pair = await getAuthorizedPair(req.user, req.params.contactId);
    if (!pair) {
      return res.status(404).send("Contact not found");
    }

    const noteText = req.body.noteText || "";
    const existing = await knex("client_notes")
      .where({
        consultant_id: pair.consultantId,
        client_id: pair.clientId,
      })
      .first();

    if (existing) {
      await knex("client_notes")
        .where({ id: existing.id })
        .update({
          note_text: noteText,
          updated_at: knex.fn.now(),
        });
    } else {
      await knex("client_notes").insert({
        consultant_id: pair.consultantId,
        client_id: pair.clientId,
        note_text: noteText,
      });
    }

    res.json({ noteText });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});

router.get("/attachments/:attachmentId", authorize, async (req, res) => {
  try {
    const attachment = await knex("client_message_attachments as attachment")
      .join("client_messages as message", "attachment.message_id", "message.id")
      .where("attachment.id", req.params.attachmentId)
      .select(
        "attachment.id",
        "attachment.original_name as originalName",
        "attachment.file_path as filePath",
        "message.consultant_id as consultantId",
        "message.client_id as clientId"
      )
      .first();

    if (!attachment) {
      return res.status(404).send("Attachment not found");
    }

    const allowed =
      req.user.id === attachment.consultantId || req.user.id === attachment.clientId;

    if (!allowed) {
      return res.status(403).send("Forbidden");
    }

    return res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});

module.exports = router;
