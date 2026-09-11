require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const MPESA_BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

function normalizePhone(phone) {
  const value = String(phone || "").replace(/\s+/g, "");

  if (/^07\d{8}$/.test(value) || /^01\d{8}$/.test(value)) {
    return "254" + value.slice(1);
  }

  if (/^\+254[17]\d{8}$/.test(value)) {
    return value.slice(1);
  }

  if (/^254[17]\d{8}$/.test(value)) {
    return value;
  }

  throw new Error("Invalid Kenyan M-PESA phone number.");
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function getAccessToken() {
  if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
    throw new Error("Daraja Consumer Key/Secret are not configured.");
  }

  const credentials = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`
      },
      timeout: 15000
    }
  );

  return response.data.access_token;
}

app.post("/api/mpesa/stkpush", async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        success: false,
        message: "M-PESA number and amount are required."
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a whole number greater than zero."
      });
    }

    let formattedPhone;
    try {
      formattedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }


    if (!process.env.CALLBACK_URL) {
      return res.status(503).json({
        success: false,
        message: "CALLBACK_URL is not configured."
      });
    }

    const accessToken = await getAccessToken();
    const time = timestamp();

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${time}`
    ).toString("base64");

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: time,
      TransactionType: "CustomerPayBillOnline",
      Amount: numericAmount,
      PartyA: formattedPhone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "WEBPAY",
      TransactionDesc: "Website payment"
    };

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    console.log("STK Push response:", response.data);

    return res.json({
      success: true,
      message:
        "STK Push sent. Check the M-PESA phone and enter the PIN.",
      data: response.data
    });
  } catch (error) {
    const details = error.response?.data || error.message;
    console.error("M-PESA error:", details);

    return res.status(500).json({
      success: false,
      message: "Unable to initiate the M-PESA payment.",
      details
    });
  }
});

app.post("/api/mpesa/callback", (req, res) => {
  console.log("M-PESA CALLBACK:");
  console.log(JSON.stringify(req.body, null, 2));

  // Important:
  // A production application should parse ResultCode/CallbackMetadata,
  // store the transaction, and verify the order/payment before marking it paid.

  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    environment: process.env.MPESA_ENV || "sandbox"
  });
});

app.listen(PORT, () => {
  console.log(`M-PESA website running on http://localhost:${PORT}`);
  console.log(`Daraja environment: ${process.env.MPESA_ENV || "sandbox"}`);
});
