
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["superadmin", "admin"], default: "admin" },
  },
  { timestamps: true }
);
const Admin = mongoose.model("admin", adminSchema);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected");

    const email = "testadmin@trackfast.com";
    const pass = "admin123";
    const hash = await bcrypt.hash(pass, 10);

    // Delete if exists
    await Admin.deleteOne({ email });

    await Admin.create({
      email,
      passwordHash: hash,
      role: "superadmin"
    });

    console.log("CREATED_ADMIN:", email, pass);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
