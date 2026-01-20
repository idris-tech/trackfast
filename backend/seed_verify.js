
const mongoose = require("mongoose");
require("dotenv").config();

const parcelSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  contact: { type: String },
  description: { type: String },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, required: true },
  estimated_delivery: { type: String },
  state: { type: String, default: "active" },
  pause_message: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  timeline: [{ status: String, location: String, time: Date }],
});

const Parcel = mongoose.model("parcel", parcelSchema);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const id = "TRK-VERIFY-" + Math.floor(Math.random() * 10000);
    const p = await Parcel.create({
      id,
      sender: "Test Sender",
      receiver: "Test Receiver",
      origin: "New York",
      destination: "London",
      status: "In Transit",
      timeline: [{ status: "In Transit", location: "New York", time: new Date() }]
    });

    console.log("CREATED_PARCEL_ID:", p.id);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
