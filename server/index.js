require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');
const http = require('http');
const https = require(`https`);
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerDocument = YAML.load('./swagger.yaml');
const fs = require('fs');
app.use(express.static(path.join(__dirname, 'build')));

const userRoutes = require("./routes/user");
const appointmentRoutes = require('./routes/appointments'); 

const PORT = process.env.PORT || 8080;

let connectedPeers = [];

app.use(cors());
app.use(express.json());

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Express API for JSONPlaceholder',
    version: '1.0.0',
    description:
      'This is a REST API application made with Express. It retrieves data from JSONPlaceholder.',
    license: {
      name: 'Licensed Under MIT',
      url: 'https://spdx.org/licenses/MIT.html',
    },
    contact: {
      name: 'JSONPlaceholder',
      url: 'https://jsonplaceholder.typicode.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:8001',
      description: 'Development server',
    },
  ],
};

// Options for the swagger docs
const options = {
  // Import swaggerDefinitions
  swaggerDefinition,
  // Path to the API docs
  apis: ['./routes/*.js'], // <-- Notation for your endpoint's file
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpec = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const keyPath = '../certs/localhost-key.pem';
const certPath = '../certs/localhost.pem';

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

// Routes
app.use("/api/user", userRoutes);
app.use('/api/appointments', appointmentRoutes);

app.use(express.static(path.join(__dirname, '../client/dist/')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/dist/', 'index.html'));
});

io.on('connection', (socket)=>{
  connectedPeers.push(socket.id);
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
  socket.on('disconnect',()=> {
    const newConnectedPeers = connectedPeers.filter((socketPeer)=>{
         return socketPeer !== socket.id
     });
     connectedPeers = newConnectedPeers;
 });
});
httpServer.listen(PORT-1, '0.0.0.0', ()=>{
  console.log(`Serving HTTP on port ${PORT-1}`);
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving HTTPS on port ${PORT}`);
});

