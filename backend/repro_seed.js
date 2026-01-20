
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
// Minimal schemas
const adminSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    passwordHash: String,
    role: String
}, { timestamps: true });

const parcelSchema = new mongoose.Schema({
    id: String,
    sender: String,
    status: String,
    state: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    timeline: Array // Minimal
}, { timestamps: true });

const Admin = mongoose.model("Admin", adminSchema);
const Parcel = mongoose.model("Parcel", parcelSchema);

require("dotenv").config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected");

        const email = "regular@trackfast.com";
        const password = "password123";
        const hash = await bcrypt.hash(password, 10);

        // cleanup
        await Admin.deleteOne({ email });
        
        const admin = await Admin.create({
            email,
            passwordHash: hash,
            role: "admin"
        });
        console.log("Created Regular Admin:", admin.email);

        // cleanup parcels for this admin
        await Parcel.deleteMany({ createdBy: admin._id });

        // create parcel
        await Parcel.create({
            id: "TRK-REGULAR-1",
            sender: "Regular User",
            status: "Order Received",
            state: "active",
            createdBy: admin._id,
            timeline: []
        });
        console.log("Created Parcel for Regular Admin");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
