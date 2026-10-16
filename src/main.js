import "./style.css";
import QRCode from "qrcode";
import { buildPaymentUri, isShieldedAddress, formatAmount } from "./zip321.js";

// Zpay keeps no server and no database. The merchant's address lives only in
// this browser, and every invoice travels inside the link's #fragment, which
// browsers never send to a server.

const STORE_KEY = "zpay:address";
const app = document.getElementById("app");

// ---------- small helpers ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function networkOf(address) {
  if (isShieldedAddress(address, "mainnet")) return "mainnet";
  if (isShieldedAddress(address, "testnet")) return "testnet";
  return null;
}

function newInvoiceId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "ZP-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function toB64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function loadAddress() {
  try { return localStorage.getItem(STORE_KEY) || ""; } catch { return ""; }
}
function saveAddress(a) {
  try { localStorage.setItem(STORE_KEY, a); } catch {}
}
function forgetAddress() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
}

async function copy(text, button) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Couldn't copy";
  }
  setTimeout(() => (button.textContent = label), 1600);
}

function shortAddress(a) {
  return a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a;
}

function qrCanvas(uri) {
  const canvas = el("canvas", { class: "qr", "aria-label": "Payment QR code", role: "img" });
  QRCode.toCanvas(canvas, uri, { width: 264, margin: 1, errorCorrectionLevel: "M",
    color: { dark: "#1c1b18", light: "#ffffff" } });
  return canvas;
}

function render(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

function header() {
  return el("header", { class: "top" },
    el("span", { class: "brand" }, "Zpay"),
    el("span", { class: "tag" }, "Shielded payments for Zcash"));
}

// ---------- screens ----------
function setupScreen(error = "") {
  const input = el("textarea", { id: "addr", rows: "4", spellcheck: "false", autocomplete: "off",
    placeholder: "u1…" });
  input.value = loadAddress();
  const msg = el("p", { class: "error", role: "alert" }, error);

  function save() {
    const a = input.value.trim();
    if (!networkOf(a)) {
      msg.textContent = "That isn't a shielded address. Copy the u1… address from your wallet's Receive screen. Transparent t1… addresses aren't accepted.";
      return;
    }
    saveAddress(a);
    chargeScreen();
  }

  render(header(),
    el("section", { class: "panel" },
      el("h1", {}, "Where should payments go?"),
      el("p", { class: "lead" }, "Paste your shielded Zcash address. It stays on this device and is only put inside the payment requests you create."),
      el("label", { for: "addr" }, "Your shielded address"),
      input, msg,
      el("button", { class: "primary", onclick: save }, "Save address")));
  input.focus();
}

function chargeScreen() {
  const address = loadAddress();
  if (!networkOf(address)) return setupScreen();

  const amount = el("input", { id: "amt", inputmode: "decimal", autocomplete: "off", placeholder: "0.00" });
  const desc = el("input", { id: "desc", maxlength: "120", autocomplete: "off", placeholder: "Optional, e.g. 2 bags of rice" });
  const msg = el("p", { class: "error", role: "alert" });

  function create() {
    let amt;
    try { amt = formatAmount(amount.value.replace(",", ".")); }
    catch (e) { msg.textContent = e.message; amount.focus(); return; }
    receiptScreen({ address, amount: amt, desc: desc.value.trim(), id: newInvoiceId() });
  }

  render(header(),
    el("section", { class: "panel" },
      el("h1", {}, "New charge"),
      el("label", { for: "amt" }, "Amount in ZEC"),
      el("div", { class: "amount-field" }, amount, el("span", {}, "ZEC")),
      el("label", { for: "desc" }, "What it's for"),
      desc, msg,
      el("button", { class: "primary", onclick: create }, "Create payment request"),
      el("p", { class: "fine" },
        "Paying to ", el("code", {}, shortAddress(address)), " · ",
        el("button", { class: "link", onclick: () => { forgetAddress(); setupScreen(); } }, "Change address"))));
  amount.addEventListener("keydown", (e) => e.key === "Enter" && create());
  desc.addEventListener("keydown", (e) => e.key === "Enter" && create());
  amount.focus();
}

function requestUri({ address, amount, desc, id }) {
  const memo = desc ? `Zpay ${id}: ${desc}` : `Zpay ${id}`;
  return buildPaymentUri({ address, amount, memo, message: desc || undefined, network: networkOf(address) });
}

function receipt({ address, amount, desc, id, uri, payer }) {
  return el("article", { class: "receipt" },
    el("p", { class: "receipt-id" }, id),
    el("p", { class: "receipt-amount" }, amount, el("span", {}, " ZEC")),
    desc ? el("p", { class: "receipt-desc" }, desc) : null,
    qrCanvas(uri),
    el("div", { class: "receipt-address" },
      el("p", { class: "receipt-address-label" }, payer ? "You're paying" : "Payments go to"),
      el("code", {}, address),
      el("p", { class: "receipt-address-hint" },
        payer ? "Check this matches the address your wallet shows before you send."
              : "Check this is your own address.")),
    el("p", { class: "receipt-hint" },
      payer ? "Scan with your Zcash wallet, or tap the button below on this phone."
            : "Ask the customer to scan this with their Zcash wallet."));
}

function receiptScreen(inv) {
  const uri = requestUri(inv);
  const link = `${location.origin}${location.pathname}#pay=${toB64url(JSON.stringify(inv))}`;
  const copyLink = el("button", { onclick: (e) => copy(link, e.currentTarget) }, "Copy invoice link");

  render(header(),
    receipt({ ...inv, uri }),
    el("div", { class: "actions" },
      copyLink,
      el("button", { class: "primary", onclick: chargeScreen }, "New charge")),
    el("p", { class: "fine center" },
      "The memo carries ", el("code", {}, inv.id), " so you can match this payment in your wallet."));
}

function payScreen(encoded) {
  let inv;
  try {
    inv = JSON.parse(fromB64url(encoded));
    inv.amount = formatAmount(inv.amount);
    if (!networkOf(inv.address)) throw new Error();
  } catch {
    return render(header(), el("section", { class: "panel" },
      el("h1", {}, "This payment link is broken"),
      el("p", { class: "lead" }, "Part of the link is missing or was changed. Ask the sender to copy the invoice link again.")));
  }
  const uri = requestUri(inv);
  const copyReq = el("button", { onclick: (e) => copy(uri, e.currentTarget) }, "Copy payment request");

  render(header(),
    receipt({ ...inv, uri, payer: true }),
    el("div", { class: "actions" },
      copyReq,
      el("a", { class: "button primary", href: uri }, "Open in wallet")),
    el("p", { class: "fine center" },
      "Pay from a shielded wallet such as Zashi. The amount, memo and both addresses stay encrypted on chain."));
}

// ---------- routing ----------
function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("pay=")) return payScreen(hash.slice(4));
  chargeScreen();
}

window.addEventListener("hashchange", route);
route();
