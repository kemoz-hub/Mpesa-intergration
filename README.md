# M-PESA Payment Website

A simple customer-facing payment page where the customer enters only:
- M-PESA phone number
- Amount

The backend handles Daraja authentication and STK Push.

## Important

The Consumer Secret supplied in chat should be regenerated before production use. Never put the Consumer Secret in browser JavaScript.

An STK Push also requires the appropriate Daraja Short Code and Lipa na M-PESA Online Passkey. The project will return a clear configuration error while those values are blank.

## Setup

1. Install Node.js.
2. Copy `.env.example` to `.env`.
3. Put your regenerated Consumer Secret into `.env`.
4. Add your Short Code and Passkey.
5. Set `CALLBACK_URL` to a public HTTPS endpoint.
6. Run:

   npm install
   npm start

7. Open http://localhost:3000

## Customer flow

Phone number + amount
        |
        v
Backend
        |
        v
Daraja STK Push
        |
        v
Customer receives M-PESA prompt
        |
        v
Customer enters M-PESA PIN
        |
        v
Daraja callback

This starter does not claim a payment is successful merely because an STK Push was accepted. The callback is logged for later payment-status handling.
