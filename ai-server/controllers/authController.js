const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  // (later we will check DB)
  if (email === "test@gmail.com" && password === "1234") {

    const token = jwt.sign(
      { email },                  // payload
      process.env.JWT_SECRET,     // secret
      { expiresIn: "1d" }         // expiry
    );

    return res.json({ token });
  }

  res.status(401).json({ message: "Invalid credentials" });
};