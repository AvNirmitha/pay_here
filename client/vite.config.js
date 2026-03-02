import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy API requests to the backend — change BACKEND_URL in Checkout.jsx for the live URL
            "/calculate-hash": {
                target: "https://test-payhere.avishkan.com",
                changeOrigin: true,
                secure: true,
            },
            "/api": {
                target: "https://test-payhere.avishkan.com",
                changeOrigin: true,
                secure: true,
            },
        },
    },
});
