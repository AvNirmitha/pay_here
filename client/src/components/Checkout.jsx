import { useState, useCallback } from "react";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MERCHANT_ID = "YOUR_SANDBOX_MERCHANT_ID"; // ← Replace with your Merchant ID
const CURRENCY = "LKR";

// Pre-defined order for this demo
const ORDER = {
    id: `ORD-${Date.now()}`,
    item: "Premium Subscription",
    description: "1-year access to all features",
    amount: 2500.0,
    currency: CURRENCY,
};

// Dummy customer details (replace with real user data in production)
const CUSTOMER = {
    first_name: "Kamal",
    last_name: "Perera",
    email: "kamal.perera@example.com",
    phone: "0771234567",
    address: "No 1, Galle Road",
    city: "Colombo",
    country: "Sri Lanka",
};

// ─── Component ──────────────────────────────────────────────────────────────────
export default function Checkout() {
    const [status, setStatus] = useState("idle"); // idle | loading | success | dismissed | error
    const [message, setMessage] = useState("");

    const handlePayNow = useCallback(async () => {
        // Guard: PayHere SDK must be loaded
        if (!window.payhere) {
            setStatus("error");
            setMessage("PayHere SDK failed to load. Please refresh the page.");
            return;
        }

        setStatus("loading");
        setMessage("");

        // ── Step 1: Fetch secure hash from backend ──────────────────────────────
        let hash;
        try {
            const params = new URLSearchParams({
                order_id: ORDER.id,
                amount: ORDER.amount.toFixed(2),
                currency: ORDER.currency,
            });

            const res = await fetch(`/calculate-hash?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server error: ${res.status}`);
            }

            const data = await res.json();
            if (!data.hash) throw new Error("Invalid response from server — no hash returned.");
            hash = data.hash;
        } catch (err) {
            console.error("[checkout] Hash fetch failed:", err);
            setStatus("error");
            setMessage(`Could not initiate payment: ${err.message}`);
            return;
        }

        // ── Step 2: Register PayHere event callbacks ─────────────────────────────
        window.payhere.onCompleted = (orderId) => {
            console.log("[payhere] Payment completed — Order ID:", orderId);
            setStatus("success");
            setMessage(`Payment successful! Your order ID is ${orderId}. Thank you! 🎉`);
        };

        window.payhere.onDismissed = () => {
            console.log("[payhere] Payment dismissed by user.");
            setStatus("dismissed");
            setMessage("Payment was cancelled. You can try again whenever you're ready.");
        };

        window.payhere.onError = (error) => {
            console.error("[payhere] Payment error:", error);
            setStatus("error");
            setMessage(`Payment failed: ${error}`);
        };

        // ── Step 3: Build payment object and start checkout ──────────────────────
        const paymentObject = {
            sandbox: true,
            merchant_id: MERCHANT_ID,

            return_url: `${window.location.origin}/payment/success`,
            cancel_url: `${window.location.origin}/payment/cancel`,
            // ⚠️ notify_url must be a public URL (use ngrok in local dev)
            notify_url: `${window.location.origin}/api/payments/webhook`,

            order_id: ORDER.id,
            items: ORDER.item,
            amount: ORDER.amount.toFixed(2),
            currency: ORDER.currency,

            // Customer details
            ...CUSTOMER,

            // Secure hash from backend
            hash,
        };

        console.log("[checkout] Starting payment:", paymentObject);
        window.payhere.startPayment(paymentObject);
        setStatus("idle"); // Reset local status; callbacks will update it
    }, []);

    // ── Render ───────────────────────────────────────────────────────────────────
    const isLoading = status === "loading";

    return (
        <div className="checkout-card">
            {/* ─ Header ─────────────────────────────────────────────────────────── */}
            <div className="card-header">
                <div className="brand-badge">
                    <span className="dot" />
                    Secure Checkout
                </div>
                <h1>Complete Your Order</h1>
                <p className="subtitle">
                    You&apos;re one step away from your purchase.
                </p>
            </div>

            {/* ─ Body ───────────────────────────────────────────────────────────── */}
            <div className="card-body">
                {/* Order item */}
                <div className="order-item">
                    <div className="order-item-icon">✨</div>
                    <div className="order-item-info">
                        <div className="order-item-name">{ORDER.item}</div>
                        <div className="order-item-desc">{ORDER.description}</div>
                    </div>
                    <div className="order-item-price">
                        {ORDER.currency} {ORDER.amount.toFixed(2)}
                    </div>
                </div>

                {/* Price breakdown */}
                <div className="price-row">
                    <span>Subtotal</span>
                    <span>{ORDER.currency} {ORDER.amount.toFixed(2)}</span>
                </div>
                <div className="price-row">
                    <span>Tax (0%)</span>
                    <span>{ORDER.currency} 0.00</span>
                </div>
                <div className="price-row total">
                    <span>Total</span>
                    <span className="amount-highlight">
                        {ORDER.currency} {ORDER.amount.toFixed(2)}
                    </span>
                </div>

                {/* Security badges */}
                <div className="security-badges">
                    <div className="badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        SSL Secured
                    </div>
                    <div className="badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Encrypted
                    </div>
                    <div className="badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        PayHere Verified
                    </div>
                </div>

                {/* Pay button */}
                <button
                    className="pay-button"
                    onClick={handlePayNow}
                    disabled={isLoading}
                    aria-label="Pay now with PayHere"
                >
                    <div className="btn-content">
                        {isLoading ? (
                            <>
                                <span className="spinner" />
                                <span>Preparing Payment…</span>
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                </svg>
                                <span>Pay {ORDER.currency} {ORDER.amount.toFixed(2)}</span>
                            </>
                        )}
                    </div>
                </button>

                {/* Status banners */}
                {status === "success" && (
                    <div className="status-banner success">
                        <span className="status-icon">✅</span>
                        <span>{message}</span>
                    </div>
                )}
                {status === "dismissed" && (
                    <div className="status-banner info">
                        <span className="status-icon">💬</span>
                        <span>{message}</span>
                    </div>
                )}
                {status === "error" && (
                    <div className="status-banner error">
                        <span className="status-icon">❌</span>
                        <span>{message}</span>
                    </div>
                )}
            </div>

            {/* ─ Footer ─────────────────────────────────────────────────────────── */}
            <div className="card-footer">
                <div className="order-id-chip">Order #{ORDER.id}</div>
                <p style={{ marginTop: "12px" }}>
                    Powered by{" "}
                    <a href="https://www.payhere.lk" target="_blank" rel="noreferrer">
                        PayHere
                    </a>{" "}
                    · Payments are processed securely.
                </p>
            </div>
        </div>
    );
}
