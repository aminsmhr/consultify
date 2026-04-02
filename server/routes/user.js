const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const knex = require("knex")(require("../knexfile"));

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - first_name
 *         - last_name
 *         - email
 *         - password
 *         - role
 *       properties:
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 *         phone:
 *           type: string
 *         address:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           description: "'0' for consultant, '1' for client"
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     TokenResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 *         phone:
 *           type: string
 *         address:
 *           type: string
 *         email:
 *           type: string
 *         type:
 *           type: string
 */

/**
 * @swagger
 * /api/user/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or registration failed
 */
router.post("/register", async (req, res) => {
  const { first_name, last_name, phone, address, email, password, role } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).send("Please enter the required fields.");
  }

  const encrypted = bcrypt.hashSync(password);
  const newUser = {
    first_name,
    last_name,
    phone,
    address,
    email,
    password: encrypted,
    type: role,
  };

  try {
    await knex("users").insert(newUser);
    res.status(201).send("Registered!");
  } catch (e) {
    console.error(e);
    res.status(400).json({
      error: "failed reg",
      message: e.message,
    });
  }
});

/**
 * @swagger
 * /api/user/login:
 *   post:
 *     summary: Log in a user and receive a JWT
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Invalid credentials or missing fields
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send("Please enter the required fields");
  }

  const user = await knex("users").where({ email }).first();

  if (!user) {
    return res.status(400).send("no user with that email");
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).send("Invalid password");
  }

  const token = jwt.sign(
    { email: user.email, id: user.id, type: user.type },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/**
 * @swagger
 * /api/user/current:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing authorization header
 */
router.get("/current", authorize, async (req, res) => {
  res.json(req.user);
});

/**
 * @swagger
 * /api/user/current:
 *   patch:
 *     summary: Update the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Updated user profile
 *       400:
 *         description: Invalid request
 */
router.patch("/current", authorize, async (req, res) => {
  const { first_name, last_name, phone, address, email, password } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  try {
    const existingUser = await knex("users")
      .where({ email })
      .whereNot({ id: req.user.id })
      .first();

    if (existingUser) {
      return res.status(400).json({ error: "Email is already in use." });
    }

    const updates = {
      first_name,
      last_name,
      phone: phone || null,
      address: address || null,
      email,
    };

    if (password) {
      updates.password = bcrypt.hashSync(password);
    }

    await knex("users").where({ id: req.user.id }).update(updates);
    const updatedUser = await knex("users").where({ id: req.user.id }).first();
    const { password: hiddenPassword, ...userSansPw } = updatedUser;

    res.json(userSansPw);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to update profile.", message: error.message });
  }
});

/**
 * @swagger
 * /api/user/consultants:
 *   get:
 *     summary: List available consultants
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consultants list
 *       500:
 *         description: Server error
 */
router.get("/consultants", authorize, async (req, res) => {
  try {
    const consultants = await knex("users")
      .select("id", "first_name", "last_name", "email", "phone", "address")
      .where({ type: "0" });
    res.status(200).send(consultants);
  } catch (e) {
    console.log(e);
    res.status(500).send("Server encountered an issue");
  }
});

/**
 * @swagger
 * /api/user/{id}:
 *   get:
 *     summary: Get a user by id
 *     tags: [Users]
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
 *         description: Matching user
 *       500:
 *         description: Server error
 */
router.get("/:id", authorize, async (req, res) => {
  try {
    const consultants = await knex("users")
      .select("id", "first_name", "last_name")
      .where({ id: req.params.id });
    res.status(200).send(consultants);
  } catch (e) {
    console.log(e);
    res.status(500).send("Server encountered an issue");
  }
});

async function authorize(req, res, next) {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).send("no auth");
  }

  const token = authorization.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await knex("users").where({ id: payload.id }).first();
    const { password, ...userSansPW } = user;
    req.user = userSansPW;
    next();
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: e });
  }
}

/**
 * @swagger
 * /api/user/appointments/book:
 *   post:
 *     summary: Book an appointment with a consultant
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consultantId
 *               - dateTime
 *             properties:
 *               consultantId:
 *                 type: integer
 *               dateTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Appointment created
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Consultant not found
 *       500:
 *         description: Server error
 */
router.post("/appointments/book", authorize, async (req, res) => {
  const { consultantId, dateTime } = req.body;
  const userId = req.user.id;

  if (!consultantId || !dateTime) {
    return res.status(400).send("Invalid consultant or dateTime.");
  }

  const consultant = await knex("users").where({ id: consultantId, type: 0 }).first();
  if (!consultant) {
    return res.status(404).send("Consultant not found.");
  }

  const newAppointment = {
    client_id: userId,
    consultant_Id: consultantId,
    date_time: dateTime,
    status: "requested",
  };

  try {
    await knex("appointments").insert(newAppointment);
    res.status(201).json(newAppointment);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error booking appointment");
  }
});

module.exports = router;
