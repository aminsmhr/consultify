const router = require("express").Router();
const jwt = require("jsonwebtoken");
const knex = require("knex")(require("../knexfile"));

/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       properties:
 *         appointmentId:
 *           type: integer
 *         consultantId:
 *           type: integer
 *         consultantFirstName:
 *           type: string
 *         consultantLastName:
 *           type: string
 *         clientId:
 *           type: integer
 *         clientFirstName:
 *           type: string
 *         clientLastName:
 *           type: string
 *         appointmentDateTime:
 *           type: string
 *           format: date-time
 *         appointmentStatus:
 *           type: string
 */

async function authorize(req, res, next) {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).send("Authorization token is required");
  }
  const token = authorization.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await knex("users").where({ id: payload.id }).first();
    if (!user) {
      return res.status(404).send("User not found");
    }
    req.user = user;
    next();
  } catch (e) {
    res.status(400).send("Invalid token");
  }
}

/**
 * @swagger
 * /api/appointments/list:
 *   get:
 *     summary: List appointments for the current user
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointments list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 *       401:
 *         description: Missing authorization token
 *       500:
 *         description: Server error
 */
router.get("/list", authorize, async (req, res) => {
  try {
    const field = req.user.type == "1" ? "appointments.client_id" : "appointments.consultant_id";
    const appointments = await knex("appointments")
      .join("users as consultant", "appointments.consultant_id", "=", "consultant.id")
      .join("users as client", "appointments.client_id", "=", "client.id")
      .where({ [field]: req.user.id })
      .select(
        "consultant.id as consultantId",
        "consultant.first_name as consultantFirstName",
        "consultant.last_name as consultantLastName",
        "consultant.type as consultantType",
        "consultant.address as consultantAddress",
        "consultant.phone as consultantPhone",
        "consultant.email as consultantEmail",
        "client.id as clientId",
        "client.first_name as clientFirstName",
        "client.last_name as clientLastName",
        "client.type as clientType",
        "client.address as clientAddress",
        "client.phone as clientPhone",
        "client.email as clientEmail",
        "appointments.id as appointmentId",
        "appointments.date_time as appointmentDateTime",
        "appointments.status as appointmentStatus",
        "appointments.client_socket_id as clientSocketId",
        "appointments.consultant_socket_id as consultantSocketId"
      );

    res.json(appointments);
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error occurred");
  }
});

/**
 * @swagger
 * /api/appointments/{appointmentId}/socket:
 *   patch:
 *     summary: Update the socket id for an appointment participant
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientSocketId:
 *                 type: string
 *               consultantSocketId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns the peer socket id when available
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Appointment not found or unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/:appointmentId/socket", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;
  const { clientSocketId, consultantSocketId } = req.body;

  if (!appointmentId || (!clientSocketId && !consultantSocketId)) {
    return res.status(400).send("Invalid appointment or socket ID.");
  }

  try {
    const fieldToUpdate = {};
    if (req.user.type == "1" && clientSocketId) {
      fieldToUpdate.client_socket_id = clientSocketId;
    } else if (req.user.type == "0" && consultantSocketId) {
      fieldToUpdate.consultant_socket_id = consultantSocketId;
    } else {
      return res.status(400).send("Invalid or unauthorized update attempt.");
    }

    const updatedCount = await knex("appointments")
      .where({ id: appointmentId })
      .update(fieldToUpdate);

    if (updatedCount) {
      await req.app.get("emitAppointmentPresenceById")(appointmentId);
      const appointment = await knex("appointments").where({ id: appointmentId }).first();

      if (req.user.type == "0" && appointment.client_socket_id) {
        res.json({ peerSocket: appointment.client_socket_id });
        return;
      }

      if (req.user.type == "1" && appointment.consultant_socket_id) {
        res.json({ peerSocket: appointment.consultant_socket_id });
        return;
      }
    } else {
      res.status(404).send("Appointment not found or unauthorized");
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while updating the socket ID");
    return;
  }
});

/**
 * @swagger
 * /api/appointments/{appointmentId}/delete:
 *   delete:
 *     summary: Delete an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment canceled
 *       404:
 *         description: Appointment not found or unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:appointmentId/delete", authorize, async (req, res) => {
  try {
    const deletedCount = await knex("appointments")
      .where({ id: req.params.appointmentId })
      .del();
    if (deletedCount) {
      res.status(200).send("Appointment canceled");
    } else {
      res.status(404).send("Appointment not found or unauthorized");
    }
  } catch (e) {
    res.status(500).send("Server error occurred");
  }
});

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Get appointment details by id
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment details
 *       404:
 *         description: Appointment not found
 *       500:
 *         description: Server error
 */
router.get("/:id", authorize, async (req, res) => {
  try {
    const appointment = await knex("appointments")
      .where({ id: req.params.id })
      .first();

    if (appointment) {
      res.json({
        id: appointment.id,
        dateTime: appointment.date_time,
        status: appointment.status,
        clientSocketId: appointment.client_socket_id,
        consultantSocketId: appointment.consultant_socket_id,
      });
    } else {
      res.status(404).send("Appointment not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});

/**
 * @swagger
 * /api/appointments/{appointmentId}/cancel:
 *   patch:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment canceled
 *       404:
 *         description: Appointment not found or unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/:appointmentId/cancel", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;

  if (!appointmentId) {
    return res.status(400).send("Invalid appointment ID.");
  }

  try {
    const updatedCount = await knex("appointments")
      .where({ id: appointmentId })
      .update({ status: "canceled" });

    if (updatedCount) {
      res.status(200).send("Appointment canceled");
    } else {
      res.status(404).send("Appointment not found or unauthorized");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while canceling the appointment");
  }
});

/**
 * @swagger
 * /api/appointments/{appointmentId}/accept:
 *   patch:
 *     summary: Accept an appointment as consultant
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment accepted
 *       404:
 *         description: Appointment not found or unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/:appointmentId/accept", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;

  if (!appointmentId) {
    return res.status(400).send("Invalid appointment ID.");
  }

  try {
    const updatedCount = await knex("appointments")
      .where({ id: appointmentId, consultant_id: req.user.id })
      .update({ status: "accepted" });

    if (updatedCount) {
      res.status(200).send("Appointment accepted");
    } else {
      res.status(404).send("Appointment not found or unauthorized");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while accepting the appointment");
  }
});

module.exports = router;
