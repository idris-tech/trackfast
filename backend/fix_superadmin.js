
const mongoose = require("mongoose");
require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const email = (process.env.ADMIN_EMAIL || "admin@trackfast.com").trim().toLowerCase();
    
    // Force update
    const res = await mongoose.connection.collection("admins").updateOne(
      { email: email },
      { $set: { role: "superadmin" } }
    );

    console.log(`Updated ${email} to superadmin:`, res.modifiedCount > 0 ? "Success" : "Already superadmin or not found");
    
    // Verify
    const admin = await mongoose.connection.collection("admins").findOne({ email });
    console.log("Current Admin State:", admin);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
