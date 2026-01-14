const mongoose = require("mongoose");

const TimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    location: { type: String, required: true },
    time: { type: Date, required: true },
  },
  { _id: false }
);

const ParcelSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true }, // TRK-XXXX
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    contact: { type: String, default: "" },
    description: { type: String, default: "" },

    origin: { type: String, required: true },
    destination: { type: String, required: true },

    status: { type: String, required: true },
    estimated_delivery: { type: String, default: "" }, // keep as string (YYYY-MM-DD)
    state: { type: String, enum: ["active", "paused"], default: "active" },

    createdAt: { type: Date, default: Date.now },
    timeline: { type: [TimelineSchema], default: [] },
  },
  { versionKey: false }
);

module.exports = mongoose.model("Parcel", ParcelSchema);
