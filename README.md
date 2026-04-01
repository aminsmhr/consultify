
# Project Title
Consultify

## Overview

Consultify serves as a versatile platform connecting consultants with clients across various industries, offering real-time consultations, scheduling, and efficient communication channels.

### Problem

Accessing reliable consultancy services is often challenging due to geographical limitations and scheduling conflicts. Clients seek immediate advice and personalized assistance, while consultants struggle to reach a wider client base efficiently.

### User Profile

- **Consultants**:
  - Offer specialized services
  - Manage schedules and appointments
  - Engage in real-time consultations
- **Clients**:
  - Seek expert advice
  - Schedule consultations
  - Engage in real-time discussions with consultants

### Features

- **Client-Side**:
  - Find consultants based on expertise
  - Schedule appointments
  - Real-time chat with consultants via WebRTC
- **Consultant-Side**:
  - Profile creation with expertise listing
  - Availability calendar
  - Accept/Reject appointments
  - Video consultations with clients

### Tech Stack

- **Frontend**:
  - React
  - SCSS for styling
  - Axios for API calls
- **Backend**:
  - Node.js with Express
  - MySQL for database
  - Knex.js for query building
  - JWT for authentication
  - WebRTC for real-time video consultations
  - Socket.IO

### APIs

- No external APIs will be used initially

### Sitemap

- Home
- Client Dashboard
- Consultant Dashboard
- Appointment Scheduler
- Video Consultation
- Sign in and Sign up

### Mockups

#### Home Page
![Home Page](./readme/home-page-mockup.jpg)

#### Consultant Profile
![Consultant Profile](./readme/consultant-profile-mockup.jpg)

#### Appointment Scheduler
![Appointment Scheduler](./readme/appointment-scheduler-mockup.jpg)

#### Video Consultation
![Video Consultation](./readme/video-consultation-mockup.jpg)

### Data Structure

- **Users Table**:
  - id
  - username
  - email
  - password
  - role (consultant or client)
- **Appointments Table**:
  - client_id
  - consultant_id
  - date_time
  - status

### Endpoints

**POST /users/register**

- Register a new user

**POST /users/login**

- Login a user

**GET /consultants**

- Get list of available consultants

**POST /appointments/book**

- Book an appointment with a consultant

**WS /video/connect**

- Initiate a WebRTC connection for video consultation

### Authentication

- JWT-based authentication for user login and session management

## Roadmap

- Setup frontend and backend projects
- Create user authentication endpoints
- Develop consultant and client profiles
- Implement consultant search and appointment scheduling features
- Implement real-time video consultations using WebRTC
- Testing and bug fixes
- Deployment and production-ready setup

## Potential Future Additions

- **Payment Integration**: Integrate a secure payment gateway for transactions
- **Review and Rating System**: Enable users to provide feedback on consultations
- **Enhanced User Profile Customization**: Provide additional options for user profile personalization
- **Multi-language Support**: Expand accessibility through multiple language options

This proposal aims to create an adaptable and user-friendly consulting platform, facilitating efficient communication, scheduling, and consultations between consultants and clients. While the initial focus is on core functionalities, the potential future additions pave the way for a more comprehensive and feature-rich platform.


# Installation

1. Update `/server/knexfile.js` with your database credentials.

2. Create a database called `consultify`, or update `/server/knexfile.js` with the name of a newly created database of your choosing.

3. Open two terminals.

4. In first terminal, run:
    - `cd client`
    - `npm i`
    - `npm run build`

5. In second terminal, run:
    - `cd server`
    - `npm i`
    - `npm run migrate`
    - `npm run dev`

# GitHub Actions Deployment

This repo includes a GitHub Actions workflow at [deploy.yml](./.github/workflows/deploy.yml) that can deploy to the same SSH server used for `nimadrivingschool.com`.

It does the following on every push to `proposal`, `main`, or `master`, and also supports manual runs:

- Copies the repository to the target server directory over SSH
- Writes `client/.env` and `server/.env` from GitHub Secrets if provided
- Runs `npm ci` in `server` and `client`
- Runs `npm run migrate` in `server`
- Runs `npm run build` in `client`
- Restarts the app with PM2

Add these repository secrets before using it:

- `DEPLOY_HOST`: server hostname or IP
- `DEPLOY_PORT`: SSH port, usually `22`
- `DEPLOY_USER`: SSH user
- `DEPLOY_SSH_KEY`: private SSH key for the server
- `DEPLOY_PATH`: absolute path where this app should live on the server
- `DEPLOY_SERVER_ENV`: full contents of `server/.env`
- `DEPLOY_CLIENT_ENV`: optional full contents of `client/.env`
- `DEPLOY_PM2_APP_NAME`: PM2 process name, for example `consultify`

Example `DEPLOY_SERVER_ENV` for production:

```env
JWT_SECRET=replace-with-a-long-random-secret
PORT=8001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=consultify
```

Server assumptions:

- Node.js and npm are installed
- PM2 is installed globally
- The target path exists or can be created by the SSH user
- MySQL is reachable from the server using the values in `server/.env` and `server/knexfile.js`
