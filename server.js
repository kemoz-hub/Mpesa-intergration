require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
const publicPath = path.join(__dirname, "public");

console.log("Application directory:", __dirname);
console.log("Public directory:", publicPath);

app.use(express.static(publicPath));

// Explicit homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});


// -----------------------------
// PHONE NUMBER
// -----------------------------

function normalizePhone(phone) {

    const value = String(phone || "").replace(/\s+/g, "");

    if (/^07\d{8}$/.test(value)) {
        return "254" + value.substring(1);
    }

    if (/^01\d{8}$/.test(value)) {
        return "254" + value.substring(1);
    }

    if (/^\+254[17]\d{8}$/.test(value)) {
        return value.substring(1);
    }

    if (/^254[17]\d{8}$/.test(value)) {
        return value;
    }

    throw new Error("Invalid Kenyan M-PESA phone number.");
}


// -----------------------------
// TIMESTAMP
// -----------------------------

function getTimestamp() {

    const now = new Date();

    const pad = (number) =>
        String(number).padStart(2, "0");

    return (
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds())
    );
}


// -----------------------------
// ACCESS TOKEN
// -----------------------------

async function getAccessToken() {

    const credentials = Buffer
        .from(
            `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
        )
        .toString("base64");

    const baseURL =
        process.env.MPESA_ENV === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke";

    const response = await axios.get(
        `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${credentials}`
            }
        }
    );

    return response.data.access_token;
}


// -----------------------------
// STK PUSH
// -----------------------------

app.post("/api/mpesa/stkpush", async (req, res) => {

    try {

        const { phone, amount } = req.body;

        if (!phone || !amount) {

            return res.status(400).json({
                success: false,
                message: "M-PESA number and amount are required."
            });
        }

        if (
            !process.env.MPESA_SHORTCODE ||
            !process.env.MPESA_PASSKEY
        ) {

            return res.status(503).json({
                success: false,
                message:
                    "M-PESA Short Code and Passkey have not been configured."
            });
        }

        const formattedPhone =
            normalizePhone(phone);

        const numericAmount =
            Number(amount);

        if (
            !Number.isInteger(numericAmount) ||
            numericAmount < 1
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid payment amount."
            });
        }

        const baseURL =
            process.env.MPESA_ENV === "production"
                ? "https://api.safaricom.co.ke"
                : "https://sandbox.safaricom.co.ke";

        const token =
            await getAccessToken();

        const timestamp =
            getTimestamp();

        const password =
            Buffer
                .from(
                    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
                )
                .toString("base64");

        const requestData = {

            BusinessShortCode:
                process.env.MPESA_SHORTCODE,

            Password:
                password,

            Timestamp:
                timestamp,

            TransactionType:
                "CustomerPayBillOnline",

            Amount:
                numericAmount,

            PartyA:
                formattedPhone,

            PartyB:
                process.env.MPESA_SHORTCODE,

            PhoneNumber:
                formattedPhone,

            CallBackURL:
                process.env.CALLBACK_URL,

            AccountReference:
                "WEBPAY",

            TransactionDesc:
                "Website payment"
        };

        const response =
            await axios.post(
                `${baseURL}/mpesa/stkpush/v1/processrequest`,
                requestData,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

        console.log(
            "STK PUSH:",
            response.data
        );

        res.json({
            success: true,
            message:
                "STK Push sent. Check your phone.",
            data:
                response.data
        });

    } catch (error) {

        console.error(
            "M-PESA ERROR:",
            error.response?.data ||
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to initiate M-PESA payment.",
            error:
                error.response?.data ||
                error.message
        });
    }
});


// -----------------------------
// M-PESA CALLBACK
// -----------------------------

app.post(
    "/api/mpesa/callback",
    (req, res) => {

        console.log(
            "M-PESA CALLBACK"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        res.json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });
    }
);


// -----------------------------
// HEALTH CHECK
// -----------------------------

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            status: "online",
            mpesa:
                process.env.MPESA_ENV ||
                "sandbox"
        });
    }
);


// -----------------------------
// START
// -----------------------------

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Public directory: ${publicPath}`
        );
    }
);
