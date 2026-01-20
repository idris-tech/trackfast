// server.js (Render-ready)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
// 🔍 DEBUG: LOG ALL REQUESTS
app.use((req, res, next) => {
  console.log("➡️ REQUEST:", req.method, req.url);
  next();
});

// ===== SERVE FRONTEND =====
app.use(express.static(path.join(__dirname, "public")));

// ===== MONGOOSE MODELS =====
const adminSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["superadmin", "admin"],
      default: "admin",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "admin" },
  },
  { timestamps: true }
);

const parcelSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // TRK-XXXX
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  contact: { type: String },
  description: { type: String },

  origin: { type: String, required: true },
  destination: { type: String, required: true },

  status: { type: String, required: true },
  estimated_delivery: { type: String },
  state: { type: String, enum: ["active", "paused"], default: "active" },

  // pause reason (shown to users)
  pause_message: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "admin" },

  timeline: [
    {
      status: String,
      location: String,
      time: Date,
    },
  ],
});

const messageSchema = new mongoose.Schema({
  parcelId: { type: String, required: true },
  sender: { type: String, enum: ["user", "admin", "superadmin"], required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "admin" }, // if sender is admin
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Admin = mongoose.model("admin", adminSchema);
const Parcel = mongoose.model("parcel", parcelSchema);
const Message = mongoose.model("message", messageSchema);

// ===== HELPERS =====
function signToken(admin) {
  return jwt.sign(
    {
      adminId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

// ===== ROUTES =====

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "TrackFast API running" });
});

// Frontend entry
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ===== ADMIN LOGIN =====
app.post("/api/admin/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(admin);
    return res.json({ token, role: admin.role, email: admin.email });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ===== CREATE PARCEL (PROTECTED) =====
app.post("/api/parcels", authMiddleware, async (req, res) => {
  try {
    const {
      sender,
      receiver,
      contact,
      description,
      origin,
      destination,
      estimated_delivery,
      status,
    } = req.body;

    if (!sender || !receiver || !origin || !destination || !status) {
      return res.status(400).json({
        message:
          "Missing required fields (sender, receiver, origin, destination, status)",
      });
    }

    const now = new Date();

    const trackingId =
      "TRK-" + Math.random().toString(16).slice(2, 10).toUpperCase();

    const newParcel = await Parcel.create({
      id: trackingId,
      sender,
      receiver,
      contact,
      description,
      origin,
      destination,
      status,
      estimated_delivery,
      state: "active",
      pause_message: "",
      createdAt: now,
      createdBy: req.admin.adminId,
      timeline: [{ status, location: origin, time: now }],
    });

    return res.status(201).json(newParcel);
  } catch (err) {
    console.error("CREATE PARCEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ===== GET ALL PARCELS (PROTECTED) =====
// ===== GET ALL PARCELS (PROTECTED) =====
app.get("/api/parcels", authMiddleware, async (req, res) => {
  let query = {};
  
  // If not superadmin, restrict to own parcels
  if (req.admin.role !== 'superadmin') {
      query.createdBy = req.admin.adminId;
  }
  
  const parcels = await Parcel.find(query).sort({ createdAt: -1 });
  res.json(parcels);
});

// ===== TRACK PARCEL (PUBLIC) =====
// ✅ Always returns parcel (even if paused) so UI still shows tracking history
app.get("/api/parcels/:id", async (req, res) => {
  const parcel = await Parcel.findOne({ id: req.params.id });

  if (!parcel) return res.status(404).json({ message: "Parcel not found" });

  const timeline = Array.isArray(parcel.timeline) ? parcel.timeline : [];
  const pauseLocation =
    timeline.length && timeline[timeline.length - 1]?.location
      ? timeline[timeline.length - 1].location
      : parcel.origin;

  // ✅ Paused: return parcel + pause info (not 403)
  if (parcel.state === "paused") {
    return res.json({
      ...parcel.toObject(),
      paused: true,
      pauseMessage: parcel.pause_message || "",
      pauseLocation: pauseLocation || "",
    });
  }

  // ✅ Active
  return res.json({
    ...parcel.toObject(),
    paused: false,
    pauseMessage: "",
    pauseLocation: "",
  });
});

// ===== UPDATE STATUS (PROTECTED) =====
app.put("/api/parcels/:id/status", authMiddleware, async (req, res) => {
  const { status, location } = req.body;

  if (!status || !location) {
    return res
      .status(400)
      .json({ message: "Status and location are required" });
  }

  const parcel = await Parcel.findOne({ id: req.params.id });
  if (!parcel) return res.status(404).json({ message: "Parcel not found" });

  const now = new Date();
  parcel.status = status;
  parcel.timeline.push({ status, location, time: now });
  await parcel.save();

  res.json(parcel);
});

// ===== EDIT PARCEL (PROTECTED) =====
app.put("/api/parcels/:id", authMiddleware, async (req, res) => {
  const parcel = await Parcel.findOne({ id: req.params.id });
  if (!parcel) return res.status(404).json({ message: "Parcel not found" });

  const {
    sender,
    receiver,
    contact,
    description,
    origin,
    destination,
    estimated_delivery,
    status,
  } = req.body;

  if (!sender || !receiver || !origin || !destination || !status) {
    return res.status(400).json({
      message:
        "Missing required fields (sender, receiver, origin, destination, status)",
    });
  }

  parcel.sender = sender;
  parcel.receiver = receiver;
  parcel.contact = contact;
  parcel.description = description;
  parcel.origin = origin;
  parcel.destination = destination;
  parcel.estimated_delivery = estimated_delivery;

  if (status !== parcel.status) {
    const now = new Date();
    parcel.status = status;

    const lastLocation = parcel.timeline.length
      ? parcel.timeline[parcel.timeline.length - 1].location
      : origin;

    parcel.timeline.push({
      status,
      location: lastLocation || origin,
      time: now,
    });
  }

  await parcel.save();
  res.json(parcel);
});

// ===== PAUSE/RESUME (PROTECTED) =====
// ✅ supports pauseMessage when pausing
app.put("/api/parcels/:id/state", authMiddleware, async (req, res) => {
  const { state, pauseMessage } = req.body;

  if (state !== "active" && state !== "paused") {
    return res.status(400).json({ message: "Invalid state" });
  }

  const parcel = await Parcel.findOne({ id: req.params.id });
  if (!parcel) return res.status(404).json({ message: "Parcel not found" });

  parcel.state = state;

  // If paused, save message. If resumed, clear message.
  if (state === "paused") {
    parcel.pause_message = String(pauseMessage || "").trim();
  } else {
    parcel.pause_message = "";
  }

  await parcel.save();
  res.json(parcel);
});

// ===== DELETE (PROTECTED) =====
app.delete("/api/parcels/:id", authMiddleware, async (req, res) => {
  const deleted = await Parcel.findOneAndDelete({ id: req.params.id });
  if (!deleted) return res.status(404).json({ message: "Parcel not found" });

  res.json({ message: "Parcel deleted", deleted });
});

// ===== SUPER ADMIN ROUTES =====
app.post("/api/admins", authMiddleware, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied: Super Admin only" });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newAdmin = await Admin.create({
      email,
      passwordHash,
      role: "admin",
      createdBy: req.admin.adminId,
    });

    res.json({ message: "New admin created", admin: newAdmin });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admins", authMiddleware, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const admins = await Admin.find({}, "-passwordHash");
  res.json(admins);
});

app.delete("/api/admins/:id", authMiddleware, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied" });
  }
  
  // Prevent self-delete
  if (req.params.id === req.admin.adminId) {
      return res.status(400).json({ message: "Cannot delete yourself" });
  }

  await Admin.findByIdAndDelete(req.params.id);
  res.json({ message: "Admin deleted" });
});

app.put("/api/admins/:id/password", authMiddleware, async (req, res) => {
  if (req.admin.role !== "superadmin") {
      return res.status(403).json({ message: "Access denied" });
  }

  const { password } = req.body;
  if (!password) {
      return res.status(400).json({ message: "Password required" });
  }

  const hash = await bcrypt.hash(password, 10);
  await Admin.findByIdAndUpdate(req.params.id, { passwordHash: hash });
  res.json({ message: "Password updated" });
});

// ===== SUPPORT & MESSAGES =====
app.post("/api/support/messages", async (req, res) => {
  try {
    // If sent by user (public), needs parcelId.
    // If sent by admin (authMiddleware), needs parcelId too but authenticated.
    
    // For simplicity, we'll allow public POST for users with trackingID check?
    // Actually, users just have the tracking ID, so we trust that.
    
    const { parcelId, content, sender, token } = req.body; 
    // sender: 'user' or 'admin'
    
    // Initial validation
    if (!parcelId || !content || !sender) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const parcel = await Parcel.findOne({ id: parcelId });
    if (!parcel) return res.status(404).json({ message: "Parcel not found" });

    // If admin, verify token
    let adminId = null;
    if (sender === "admin") {
       // We expect token in body or header for this route if it's mixed
       // But usually admin routes are protected. 
       // Let's rely on headers if we reuse authMiddleware, but this is a public route for users too.
       // So verify manually if admin.
       if (!token) return res.status(401).json({ message: "Admin token required" });
       try {
         const decoded = jwt.verify(token, process.env.JWT_SECRET);
         adminId = decoded.adminId;
       } catch {
         return res.status(401).json({ message: "Invalid token" });
       }
    }

    const msg = await Message.create({
      parcelId,
      sender,
      adminId, 
      content,
      read: false
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("MSG ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/support/messages/:parcelId", async (req, res) => {
  try {
    const msgs = await Message.find({ parcelId: req.params.parcelId }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) {
     res.status(500).json({ message: "Server error" });
  }
});


// ===== CONNECT DB + SEED ADMIN + START =====
(async function start() {
  try {
    if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI in .env");
    if (!process.env.JWT_SECRET) throw new Error("Missing JWT_SECRET in .env");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminHash = (process.env.ADMIN_PASSWORD_HASH || "").trim();

    if (adminEmail && adminHash) {
      const exists = await Admin.findOne({ email: adminEmail });
      if (!exists) {
        // First admin is SUPERADMIN
        await Admin.create({
          email: adminEmail,
          passwordHash: adminHash,
          role: "superadmin",
        });
        console.log("✅ Super Admin seeded:", adminEmail);
      } else {
        // If exists but no role, update to superadmin (migration)
        if (!exists.role) {
            exists.role = "superadmin";
            await exists.save();
            console.log("✅ Updated existing admin to Super Admin");
        }
        console.log("ℹ️ Admin already exists:", adminEmail);
      }
    } else {
      console.log("⚠️ ADMIN_EMAIL or ADMIN_PASSWORD_HASH missing in .env");
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Start error:", err.message);
    process.exit(1);
  }
})();
