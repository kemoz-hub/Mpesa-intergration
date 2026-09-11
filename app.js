const form = document.getElementById("paymentForm");
const phoneInput = document.getElementById("phone");
const amountInput = document.getElementById("amount");
const payButton = document.getElementById("payButton");
const message = document.getElementById("message");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function validKenyanPhone(phone) {
  return /^(07|01)\d{8}$/.test(phone) ||
         /^\+254[17]\d{8}$/.test(phone) ||
         /^254[17]\d{8}$/.test(phone);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phone = phoneInput.value.trim();
  const amount = Number(amountInput.value);

  if (!validKenyanPhone(phone)) {
    showMessage("Enter a valid Kenyan M-PESA number, for example 0712345678.", "error");
    phoneInput.focus();
    return;
  }

  if (!Number.isInteger(amount) || amount < 1) {
    showMessage("Enter a valid whole-number amount.", "error");
    amountInput.focus();
    return;
  }

  payButton.disabled = true;
  payButton.textContent = "Sending...";
  showMessage("Sending M-PESA payment request...", "loading");

  try {
    const response = await fetch("/api/mpesa/stkpush", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone,
        amount
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showMessage(
        data.message || "The payment request could not be sent.",
        "error"
      );
      return;
    }

    showMessage(
      data.message || "STK Push sent. Check your phone.",
      "success"
    );

    form.reset();
  } catch (error) {
    console.error(error);
    showMessage(
      "Could not connect to the payment server.",
      "error"
    );
  } finally {
    payButton.disabled = false;
    payButton.textContent = "Pay with M-PESA";
  }
});