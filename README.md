# Zpay

**Private point-of-sale and invoicing for Zcash.** A merchant enters an amount, Zpay shows a QR code and a shareable invoice link, and the customer pays from a shielded wallet. No server, no database, no accounts.

**Live:** https://zpay-ujemu.vercel.app
**Built for:** ZECATHON, Shielded Payments track

---

## How it works

1. **Merchant setup.** Paste a shielded Zcash address (`u1…`). It's saved only in this browser.
2. **New charge.** Enter an amount in ZEC and an optional description. Zpay creates a payment request with a unique invoice ID (e.g. `ZP-BYCTYA`).
3. **Customer pays,** in one of three ways:
   - **Scan the QR code** with a Zcash wallet (in person).
   - **Pay manually** on the same phone: copy the address and memo with one tap, then paste them into the wallet.
   - **Open in wallet,** for wallets that accept `zcash:` payment links.
4. **Merchant matches the payment.** The invoice ID travels in the encrypted memo, so the merchant can find it in their wallet's history.

Payment requests follow [ZIP-321](https://zips.z.cash/zip-0321), the standard Zcash payment URI format.

## Privacy by design

- **No server, no database.** Zpay is a static site. There is no backend to log, leak or subpoena.
- **Invoice data lives in the link's `#fragment`.** Browsers never send the part after `#` to a server, so not even the host sees amounts, addresses or descriptions.
- **The merchant address stays on the device.** It's stored in the browser's local storage and only placed inside the payment requests the merchant creates.
- **Shielded addresses only.** Transparent `t1…` addresses are rejected, so payments can't accidentally go to a public address.
- **Encrypted memo.** The invoice ID and description are sent in the shielded memo, so they're visible only to sender and receiver.
- **No tracking.** No analytics, no cookies, no third-party scripts. A `no-referrer` policy stops the browser from leaking where users came from.

## Security

- **Full receiving address shown** on both the merchant screen and the customer's pay page. If someone sends a customer a tampered invoice link with a different address, the customer can compare it with what their wallet shows before paying.
- **Security headers** on the live site: a strict Content-Security-Policy (only Zpay's own code can run), HSTS, `X-Frame-Options: DENY` (no embedding in other sites), `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy` and a restrictive `Permissions-Policy`. See `vercel.json`.
- **No secrets in the code.** Zpay holds no keys and never touches funds.
- **Dependencies audited:** `npm audit` reports 0 vulnerabilities.

## Tested on mainnet

Tested with the **Zodl** wallet on Zcash mainnet:

| Route | Invoice | Result |
| --- | --- | --- |
| QR scan | `ZP-8RUKQP` | Amount, address and memo prefilled; paid; memo delivered |
| Pay manually | `ZP-BYCTYA` | Address and memo pasted; paid; memo delivered |

**Finding:** Zodl deliberately refuses payment requests handed to it by other apps (such as a browser) and asks the user to scan the QR code instead, a safety measure against malicious links. Because of this, "Open in wallet" can't prefill a payment in Zodl. Zpay handles it by putting **Pay manually** first on the pay page and explaining the behavior next to the Open in wallet button.

## Run it locally

Requires Node.js.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. To test from a phone on the same Wi-Fi, run `npm run dev -- --host` and open the Network URL it prints.

Build for production:

```bash
npm run build
```

The output in `dist/` is a static site that can be hosted anywhere. Include the headers from `vercel.json` (or your host's equivalent).

## Project structure

```
src/main.js     Screens (setup, new charge, receipt, pay page) and routing
src/zip321.js   ZIP-321 payment URI builder, address and amount checks
src/style.css   Styles
vercel.json     Security headers for the live deployment
```

Built with Vite and plain JavaScript. The only runtime dependency is `qrcode`.

## Limitations and next steps

- **No automatic payment detection.** The merchant confirms payment by checking their wallet for the invoice memo. A future version could use a viewing key to detect incoming payments without giving up spending control.
- **Invoice links aren't signed.** Anyone could edit a link's contents. Showing the full address is the current safeguard; signed invoices would be a stronger one.
- **Amounts are in ZEC only.** Optional fiat display is a possible addition.

## License

MIT