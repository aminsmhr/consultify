const router = require("express").Router();
const jwt = require("jsonwebtoken");
const knex = require("knex")(require("../knexfile"));

// Middleware to authorize user
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

// // GET route to list appointments for the current user
// router.get("/list", authorize, async (req, res) => {
//   try {
//     const appointments = await knex("appointments")
//     .join()
//       .where({ consultant_id: req.user.id });
//     res.json(appointments);
//   } catch (e) {
//     res.status(500).send("Server error occurred");
//   }
// });

router.get("/list", authorize, async (req, res) => {
  try {
    const field = req.user.type == '1' ? 'appointments.client_id':'appointments.consultant_id';
    const appointments = await knex("appointments")
      .join('users as consultant', 'appointments.consultant_id', '=', 'consultant.id') // Joining the users table for consultant
      .join('users as client', 'appointments.client_id', '=', 'client.id') // Joining the users table for client
      .where({ [field] : req.user.id }) // Filtering appointments for the consultant (current user)
      .select(
        'consultant.id as consultantId',
        'consultant.first_name as consultantFirstName',
        'consultant.last_name as consultantLastName',
        'consultant.type as consultantType',
        'consultant.address as consultantAddress',
        'consultant.phone as consultantPhone',
        'consultant.email as consultantEmail',
        'client.id as clientId',
        'client.first_name as clientFirstName',
        'client.last_name as clientLastName',
        'client.type as clientType',
        'client.address as clientAddress',
        'client.phone as clientPhone',
        'client.email as clientEmail',
        'appointments.id as appointmentId',
        'appointments.date_time as appointmentDateTime',
        'appointments.status as appointmentStatus',
        'appointments.client_socket_id as clientSocketId',
        'appointments.consultant_socket_id as consultantSocketId'
      ); // Selecting specific fields from all tables

    res.json(appointments);
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error occurred");
  }
});

// POST route to book an appointment
router.post("/book", authorize, async (req, res) => {
  // ... existing book appointment code ...
});

// PATCH /api/appointments/:appointmentId/socket
// Update appointment's socket ID
router.patch("/:appointmentId/socket", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;
  const { clientSocketId, consultantSocketId } = req.body; // Depending on your structure, you might only need one

  // Validate input
  if (!appointmentId || (!clientSocketId && !consultantSocketId)) {
    return res.status(400).send("Invalid appointment or socket ID.");
  }

  try {
    // Determine field based on user type and if they provided the respective socketId
    const fieldToUpdate = {};
    if (req.user.type == '1' && clientSocketId) { // assuming '1' is client type
      fieldToUpdate.client_socket_id = clientSocketId;
    } else if (req.user.type == '0' && consultantSocketId) { // assuming '0' is consultant type
      fieldToUpdate.consultant_socket_id = consultantSocketId;
    } else {
      return res.status(400).send("Invalid or unauthorized update attempt.");
    }

    // Perform the update in the database
    const updatedCount = await knex("appointments")
      .where({ id: appointmentId }) // Ensure proper authorization checks here if needed
      .update(fieldToUpdate)

    // Check if the appointment was found and updated
    if(updatedCount) {
      const appointment = await knex("appointments")
      .where({ id: appointmentId })
      .first();

      if (req.user.type == '0' && appointment.client_socket_id) {
        res.json({peerSocket: appointment.client_socket_id});
      }
      
      if (req.user.type == '1' && appointment.consultant_socket_id){
        res.json({peerSocket: appointment.consultant_socket_id});
      }

      // res.status(200).send("Socket ID updated successfully");
    } else {
      res.status(404).send("Appointment not found or unauthorized");
    }
    
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while updating the socket ID");
  }
});

// DELETE route to cancel/delete an appointment
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
        // ... include other necessary appointment details
      });
    } else {
      res.status(404).send("Appointment not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error occurred");
  }
});


// PATCH /api/appointments/:appointmentId/cancel
// Cancel an appointment
router.patch("/:appointmentId/cancel", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;

  // Validate input
  if (!appointmentId) {
    return res.status(400).send("Invalid appointment ID.");
  }

  try {
    // Update the appointment status to 'canceled'
    const updatedCount = await knex("appointments")
      .where({ id: appointmentId }) // Add additional checks as necessary (e.g., only client or consultant can cancel)
      .update({ status: 'canceled' });

    // Check if the appointment was found and updated
    if(updatedCount) {
      res.status(200).send("Appointment canceled");
    } else {
      res.status(404).send("Appointment not found or unauthorized");
    }
    
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while canceling the appointment");
  }
});

// PATCH /api/appointments/:appointmentId/accept
// Accept an appointment
router.patch("/:appointmentId/accept", authorize, async (req, res) => {
  const appointmentId = req.params.appointmentId;
  
  // Validate input
  if (!appointmentId) {
    return res.status(400).send("Invalid appointment ID.");
  }

  try {
    // Update the appointment status to 'accepted'
    const updatedCount = await knex("appointments")
      .where({ id: appointmentId, consultant_id: req.user.id }) // Ensure only the consultant can accept
      .update({ status: 'accepted' });

    // Check if the appointment was found and updated
    if(updatedCount) {
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
