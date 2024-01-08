const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const knex = require("knex")(require("../knexfile"));

// ## POST /api/user/register
// - Creates a new user.
// - Expected body: { first_name, last_name, phone, address, email, password }
router.post("/register", async (req, res) => {
  console.log(req.body)
  const { first_name, last_name, phone, address, email, password , role} = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).send("Please enter the required fields.");
  }

  // encrypt password
  const encrypted = bcrypt.hashSync(password);

  // Create the new user
  const newUser = {
    first_name,
    last_name,
    phone,
    address,
    email,
    password: encrypted,
    type: role
  };

  console.log('newUser', newUser);
  // Insert it into our database
  try {
    await knex("users").insert(newUser);
    res.status(201).send("Registered!");
  } catch (e) {
    res.status(400).send("failed reg", e);
  }
});

// ## POST /api/user/login
// -   Generates and responds a JWT for the user to use for future authorization.
// -   Expected body: { email, password }
// -   Response format: { token: "JWT_TOKEN_HERE" }
/**
 * @swagger
 * /items:
 *   get:
 *     summary: List all items
 *     responses:
 *       200:
 *         description: An array of items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send("Please enter the required fields");
  }

  // find user (using the 'first' method)
  const user = await knex("users").where({ email }).first();

  if (!user) {
    return res.status(400).send("no user with that email");
  }

  // Validate the password
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).send("Invalid password");
  }

  // Generate a token
  const token = jwt.sign({ email: user.email, id: user.id, type: user.type}, process.env.JWT_SECRET);

  // send back to client
  res.json({ token });
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Retrieve a list of JSONPlaceholder users.
 *     description: Retrieve a list of users from JSONPlaceholder. Can be used to populate a list of fake users when prototyping or testing an API.
 *     responses:
 *       200:
 *         description: A list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The user ID.
 *                         example: 0
 *                       name:
 *                         type: string
 *                         description: The user's name.
 *                         example: Leanne Graham
 */
router.get("/current", authorize, async (req, res) => {
  // respond with the 'user' obj added in the 'authorize' fn
  res.json(req.user);
});

router.get("/consultants", authorize, async (req, res) => {
  try {
    const consultants = await knex("users").select('id', 'first_name', 'last_name')
    .where({type: '0'})
    res.status(200).send(consultants);
  } catch (e) {
    console.log(e);
    res.status(500).send("Server encountered an issue" );
  }
});

// ## GET /api/user/:id
// calls 'authorize' middleware
router.get("/:id", authorize, async (req, res) => {
  try {
    const consultants = await knex("users").select('id', 'first_name', 'last_name')
    .where({id: req.params.id})
    res.status(200).send(consultants);
  } catch (e) {
    console.log(e);
    res.status(500).send("Server encountered an issue" );
  }
});

// -   Gets information about the currently logged in user.
// -   If no valid JWT is provided, will respond with 401 Unauthorized.
// -   Expected headers: { Authorization: "Bearer JWT_TOKEN_HERE" }
async function authorize(req, res, next) {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).send("no auth");
  }

  // Parse out the bearer token
  const token = authorization.split(" ")[1];

  try {
    // verify the jwt.  
    // 'payload' will contain the payload encoded when the jwt was generated (signed) when we logged in.
    // If this part fails to verify, we end up in 'catch' block
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // get user (using 'first' again)
    const user = await knex("users").where({ id: payload.id }).first();

    // create a variable called 'userSansPW' that is,
    // the user without the 'password' property
    const { password, ...userSansPW } = user;

    // add to new prop on 'req' obj called 'user'
    req.user = userSansPW;

    // and go on to next fn in handler
    next();
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: e });
  }
}

router.post("/appointments/book", authorize, async (req, res) => {
  const { consultantId, dateTime } = req.body;
  const userId = req.user.id;  // Extracted from token in 'authorize' middleware

  console.log(consultantId, dateTime, userId);

  // Validate inputs
  if (!consultantId || !dateTime) {
      return res.status(400).send('Invalid consultant or dateTime.');
  }

  // Ensure the consultant exists and is available
  const consultant = await knex("users").where({ id: consultantId, type: 0 }).first();
  if (!consultant) {
      return res.status(404).send('Consultant not found.');
  }

  // Assuming a function to check if the appointment slot is available
  // const isAvailable = await checkAvailability(consultantId, dateTime);
  // if (!isAvailable) {
  //     return res.status(400).send('Time slot is not available.');
  // }

  // Creating the appointment
  const newAppointment = { 
    client_id: userId, 
    consultant_Id: consultantId, 
    date_time: dateTime,
    status: 'requested'
  };

  // Insert it into our database
  try {
      await knex("appointments").insert(newAppointment);  // Ensure you have an 'appointments' table
      res.status(201).json(newAppointment);
  } catch (e) {
      console.error(e);
      res.status(500).send("Error booking appointment");
  }
});

module.exports = router;
