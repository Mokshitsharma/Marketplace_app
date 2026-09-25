# Movigo Local Marketplace — B2C Hyperlocal Delivery App

**Concept:** A Blinkit/Zepto/Swiggy-style app where local Indore stores list items that aren't available on quick-commerce platforms (furniture, specialty goods, local-store-only SKUs). Customers order, Movigo's existing driver fleet delivers within ~30 minutes.

---

## 1. Product Scope (MVP)

- **B2C only.** No wholesale/bulk tier in this version.
- **Curated store onboarding** — start with 15–30 verified local stores in Indore, not an open marketplace. Prevents dead-trip/stock-mismatch problems.
- **Single delivery lane** — every order is small/single-item scale, fulfilled by Movigo's driver pool, target 30-min SLA.
- **Category focus for v1** — pick 2–3 categories you can actually guarantee stock accuracy for (e.g., home essentials, small furniture/decor, hardware) rather than "everything."

---

## 2. UI/UX Reference (Blinkit/Zepto/Swiggy/Zomato pattern)

| Screen | Pattern to copy |
|---|---|
| Home | Location bar at top, search bar, horizontal category chips, banner carousel, product grid with images + price + "Add" button |
| Search | Instant search-as-you-type, recent searches, category filters |
| Product detail | Image, price, stock/availability, store name, quantity stepper, "Add to cart" |
| Cart | Bottom sheet/drawer style, item list with quantity editors, delivery fee + total, sticky "Checkout" CTA |
| Checkout | Saved address selector, payment method, delivery slot (ASAP/30-min badge), order summary |
| Order tracking | Live map with driver location, status timeline (Placed → Store confirmed → Picked up → On the way → Delivered), ETA countdown |
| Order history | Card list of past orders with reorder button |

Visual style: rounded cards, bold single accent color, heavy use of product imagery, minimal text, large tap targets, bottom nav bar (Home / Search / Orders / Profile).

---

## 3. User Roles & Apps

1. **Customer app** — browse, search, order, track, pay.
2. **Store/seller dashboard** (web or lightweight mobile) — list items, edit stock/price, accept/reject incoming orders, mark ready-for-pickup.
3. **Driver app** — reuse Movigo's existing driver app; add an order-type flag (local-marketplace vs core logistics) so dispatch logic can differentiate.
4. **Admin/ops panel** — store onboarding/verification, live order monitoring, dispute handling, payout tracking.

---

## 4. Core Data Models

```
Store
- id, name, address, geo_lat, geo_lng, category, verified_status, owner_contact, bank_details

Product
- id, store_id, name, description, image_urls[], price, stock_qty, category, is_active

Customer
- id, name, phone, saved_addresses[], payment_methods[]

Order
- id, customer_id, store_id, items[{product_id, qty, price}], subtotal, delivery_fee, total,
  status (placed | store_confirmed | picked_up | on_the_way | delivered | cancelled),
  driver_id, placed_at, delivered_at, delivery_address, eta

Driver (existing Movigo entity)
- add: current_order_type (logistics | marketplace | idle)
```

---

## 5. Order Flow

1. Customer places order → order status `placed`, notification sent to store.
2. Store confirms availability within a set time window (e.g., 2 min) → `store_confirmed`. If store doesn't respond in time, auto-cancel or auto-reassign.
3. Dispatch engine assigns nearest available driver → driver notified.
4. Driver picks up from store → `picked_up`.
5. Driver delivers, marks complete → `delivered`, payment settled, store payout queued.

**Key risk to design around:** step 2. If stock isn't real, the whole 30-min promise collapses. Build the store confirmation step as a hard gate — no driver dispatched until store confirms.

---

## 6. Revenue Model

- Commission per order (store side)
- Delivery fee (customer side)
- Optional small platform/convenience fee
- No packing/bulk fees needed since wholesale is out of scope for now

---

## 7. Tech Stack Recommendation

- **Frontend (customer app):** React Native (reuse patterns from Movigo's existing mobile stack if applicable) or Flutter
- **Store dashboard:** Next.js web app (faster to onboard non-technical store owners than a native app)
- **Backend:** Node.js/Express or NestJS, PostgreSQL, Redis for live order state
- **Realtime tracking:** Socket.io or Firebase Realtime DB for driver location + order status push
- **Maps/routing:** Google Maps API (reuse Movigo's existing integration/keys if already set up)
- **Payments:** Razorpay or similar (UPI-first for Indore market)
- **Push notifications:** Firebase Cloud Messaging

---

## 8. Build Phases

**Phase 1 — Core MVP**
- Customer app: browse, cart, checkout, order tracking
- Store dashboard: product listing, stock toggle, order accept/reject
- Basic dispatch: manual or simple nearest-driver assignment
- 15–30 pilot stores, single category

**Phase 2 — Scale**
- Automated dispatch integrated with Movigo's existing driver allocation logic
- Multi-category expansion
- Ratings/reviews, reorder, promo codes

**Phase 3 — Optional wholesale layer**
- Reintroduce bulk pricing/MOQ if B2C model proves out

---

## 9. Claude Code Prompt (paste this into Claude Code to scaffold the project)

```
Build a hyperlocal B2C delivery marketplace app called "Movigo Local" with the following scope:

CONTEXT:
- This connects local Indore retail stores with end customers for items not available
  on quick-commerce apps like Blinkit/Zepto (e.g. furniture, home goods, specialty items).
- Delivery is fulfilled by an existing driver fleet (Movigo) — assume a driver-assignment
  API/service already exists and stub it as an interface I can plug in later.
- UI/UX should closely follow Blinkit/Zepto/Swiggy Instamart design patterns: rounded
  product cards, category chips, bottom-sheet cart, sticky checkout CTA, live order
  tracking with a status timeline and ETA.

SCOPE FOR THIS BUILD (B2C only, no wholesale/bulk logic):

1. Customer-facing app (React Native or responsive web — ask me which if unspecified):
   - Home screen: location bar, search bar, category chips, product grid
   - Product detail screen: image, price, stock, add-to-cart with quantity stepper
   - Cart: bottom-sheet style, editable quantities, delivery fee + total
   - Checkout: address selection, payment method (stub payment gateway integration),
     order summary, "Place order" with 30-min delivery badge
   - Order tracking: status timeline (Placed → Store Confirmed → Picked Up → On the Way
     → Delivered), live map placeholder for driver location, ETA countdown
   - Order history with reorder button

2. Store dashboard (Next.js web app):
   - Login/auth for store owners
   - Product CRUD: name, description, images, price, stock quantity, category, active toggle
   - Incoming orders list with Accept/Reject action and a countdown timer for response window
   - Mark order "ready for pickup"
   - Basic payout/earnings view

3. Backend API (Node.js + Express or NestJS, PostgreSQL):
   - Models: Store, Product, Customer, Order (with items array), Driver (stub)
   - Order state machine: placed -> store_confirmed -> picked_up -> on_the_way -> delivered
     -> cancelled, with clear transition rules and timestamps
   - Endpoints for customer app (browse/search/cart/checkout/track) and store dashboard
     (CRUD + order actions)
   - Stub a `DispatchService` interface with a single method `assignDriver(order)` that
     I will implement separately against Movigo's real driver system — don't build real
     dispatch logic, just the interface and a mock implementation that assigns a fake driver.
   - Realtime order status updates via WebSocket (Socket.io)

4. Do NOT build:
   - Wholesale/bulk pricing tiers or MOQ logic
   - Multi-vendor cart splitting logic beyond single-store-per-order (keep v1 simple:
     one order = one store)
   - Real payment gateway integration — stub it with a clear interface

Set up the project as a monorepo with clear separation: /customer-app, /store-dashboard,
/backend. Use TypeScript throughout. Include a README explaining how to run each piece
locally and where the DispatchService stub needs to be wired to the real Movigo driver
assignment system later.

Start by scaffolding the backend data models and the order state machine first, since
everything else depends on that contract.
```

---

## 10. Open Decisions Before You Build

- Is this positioned as a Movigo product (needs founder/Amit buy-in) or your own prototype first?
- Which delivery vehicle types can actually handle bulky items like furniture — does the current fleet support this, or does it need a separate vehicle tier?
- Which 2–3 categories for the pilot, and which 15–30 stores will you personally onboard first?
