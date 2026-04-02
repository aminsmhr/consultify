const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');
const http = require('http');
const https = require(`https`);
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const fs = require('fs');
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: path.join(__dirname, ".env") });
app.use(express.static(path.join(__dirname, 'build')));

const userRoutes = require("./routes/user");
const appointmentRoutes = require('./routes/appointments'); 
const clientWorkspaceRoutes = require("./routes/clientWorkspace");
const knex = require("knex")(require("./knexfile"));

const PORT = process.env.PORT || 8080;

let connectedPeers = [];

app.use(cors());
app.use(express.json());

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Consultify API',
    version: '1.0.0',
    description: 'API for user authentication, consultant lookup, and appointment management.',
    license: {
      name: 'Licensed Under MIT',
      url: 'https://spdx.org/licenses/MIT.html',
    },
    contact: {
      name: 'Consultify',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, 'routes', '*.js')],
};

const swaggerSpec = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const keyPath = path.join(__dirname, '..', 'certs', 'localhost-key.pem');
const certPath = path.join(__dirname, '..', 'certs', 'localhost.pem');

const server = https.createServer(  {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
},app);
const httpServer = http.createServer(app);

const io = require("socket.io")(server, {
    cors: {
        origin: '*',
      }
  });

async function emitAppointmentPresenceById(appointmentId) {
  const appointment = await knex("appointments")
    .join("users as consultant", "appointments.consultant_id", "=", "consultant.id")
    .join("users as client", "appointments.client_id", "=", "client.id")
    .where({ "appointments.id": appointmentId })
    .select(
      "consultant.id as consultantId",
      "consultant.first_name as consultantFirstName",
      "consultant.last_name as consultantLastName",
      "client.id as clientId",
      "client.first_name as clientFirstName",
      "client.last_name as clientLastName",
      "appointments.id as appointmentId",
      "appointments.status as appointmentStatus",
      "appointments.client_socket_id as clientSocketId",
      "appointments.consultant_socket_id as consultantSocketId"
    )
    .first();

  if (!appointment) {
    return;
  }

  io.to(`user:${appointment.clientId}`).emit("appointment:presence", appointment);
  io.to(`user:${appointment.consultantId}`).emit("appointment:presence", appointment);
}

app.set("emitAppointmentPresenceById", emitAppointmentPresenceById);

// Routes
app.use("/api/user", userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use("/api/client-workspace", clientWorkspaceRoutes);

app.use(express.static(path.join(__dirname, '../client/dist/')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/dist/', 'index.html'));
});

io.on('connection', (socket)=>{
  connectedPeers.push(socket.id);
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.join(`user:${payload.id}`);
    } catch (error) {
      console.error("Invalid socket auth token:", error.message);
    }
  }

socket.emit("me", socket.id)

  socket.on('offer', ({offer,socketId})=>{
      io.to(socketId).emit('offer', {offer: offer, _socket: socket.id});
  })

  socket.on('answer', ({answer, socketId})=>{
      io.to(socketId).emit('answer', {answer,socketId:socket.id});
  })
  
  socket.on('candidate', ({offerCandidates, socketId})=>{
      io.to(socketId).emit('candidate', offerCandidates);
  })
  socket.on('disconnect', async ()=> {
    const newConnectedPeers = connectedPeers.filter((socketPeer)=>{
         return socketPeer !== socket.id
     });
     connectedPeers = newConnectedPeers;

     try {
      const affectedAppointments = await knex("appointments")
        .where({ client_socket_id: socket.id })
        .orWhere({ consultant_socket_id: socket.id })
        .select("id");

      await knex("appointments")
        .where({ client_socket_id: socket.id })
        .update({ client_socket_id: null });

      await knex("appointments")
        .where({ consultant_socket_id: socket.id })
        .update({ consultant_socket_id: null });

      await Promise.all(
        affectedAppointments.map((appointment) => emitAppointmentPresenceById(appointment.id))
      );
     } catch (error) {
      console.error("Failed to clear disconnected socket from appointments:", error);
     }
 });
});
httpServer.listen(PORT-1, '0.0.0.0', ()=>{
  console.log(`Serving HTTP on port ${PORT-1}`);
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving HTTPS on port ${PORT}`);
});

