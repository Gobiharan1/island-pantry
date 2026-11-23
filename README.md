# Island Pantry

A private Sri Lankan grocery store preview with a searchable catalogue, a persistent basket, test checkout, stock control, and a store dashboard.

## Run locally

Use Node.js 22.13 or newer. The standalone local preview uses Node’s built-in SQLite and serves the same storefront and application logic as the hosted Site. From the project directory, run:

```sh
node api/local.mjs
```

Open `http://127.0.0.1:4317/`. The database is created under `.local/`. Stop the server with Ctrl+C. This loopback-only runner signs you in as the demo store owner. The hosted Site uses authenticated ChatGPT accounts and a configured owner email for admin access.

## Test shopping

1. Add at least Rs. 1,667 of groceries to the basket.
2. Apply `ISLAND10` for a 10% discount.
3. At checkout, use fictional details. For sample delivery, use postcode `00100`. Local collection also works.
4. Place the test order. Open My account for the record, or use the guest order number and tracking code.
5. Open **Store administration** in the footer. View the order, update its status, and check the product’s stock.

Checkout computes prices and delivery on the server. Order placement records a stock deduction, and cancelling an eligible unpaid order restores stock. The dashboard manages product variations, categories, stock, promotions, fulfilment rules, reviews and enquiries.

## Hosting

The hosted project uses Vinext and Cloudflare D1 on Sites. Install and build with `npm run install:ci` and `npm run build`. The manifest declares the D1 binding and the SQL in `drizzle/` creates the schema. Configure `ADMIN_EMAIL` and `SITE_ORIGIN` through the hosting environment. Keep the preview private.

## Launch prerequisites

- Replace sample branding, product photography, prices and inventory with approved store material. Choose delivery zones, collection location, hours and contact details.
- Connect an approved payment provider and transactional mail service. The preview records payment on delivery and stores confirmation and status events in the database. Email delivery, live card payments and refunds need merchant setup.
- Approve the public privacy, delivery and returns terms. Configure the final domain, analytics and Search Console before enabling public indexing.

The hero and catalogue photographs were generated with built-in ImageGen using a Sri Lankan rice-and-curry scene and an unbranded studio grocery contact sheet. The project includes the optimised WebP assets in `public/market/`.

### Image prompts

- **Hero** — Photorealistic natural editorial food photography for the wide homepage hero of a premium Sri Lankan grocery shop. Landscape 3:2. Top-down slight angle on matte deep mustard golden yellow table with warm bright sun from upper left. An oversized richly composed traditional Sri Lankan dinner on a dark green banana leaf: central mound of white rice, rich orange dhal curry, dark roasted chicken curry, bright red pol sambol, sauteed greens, crispy papadum. Small handmade dark clay bowls of dried red chilli and golden spices plus split coconut and fresh curry leaves around. Compose the main plate in the center-right of the frame and let ingredients extend to frame edges; the image itself will be the right half of a split layout. Authentic home cooking, editorial magazine texture, bold contrast, generous and appetizing, no hands, no type, no logos.
- **Catalogue** — A 4 columns by 3 rows contact sheet of exactly twelve distinct photorealistic studio grocery product photos for a Sri Lankan online grocer, with strict equal square cells, straight grid, no margin or gutters; every cell has its own plain soft warm ivory background (#f6f2e9) and centered single small product with generous clear padding on all four sides. This will be sliced into 12 individual thumbnails. Soft natural directional shadows, high quality magazine catalog shots. Row 1 left to right: short ivory paper bag of red samba rice and a spoon of red rice, squat bright red spice carton with dried red chilli labeled ROASTED CURRY, small yellow can of thick coconut milk with coconut half, dark red and cream rectangular packet of Sri Lankan ginger biscuits. Row 2 left to right: deep green upright tin of Ceylon black tea with a few fresh tea leaves, pile of three small red onions and green curry leaves, small clear pouch of dried red lentils, dark amber glass jar of seeni sambol caramelized onion relish. Row 3 left to right: a stack of yellow egg hoppers in a matte dark handmade bowl, rustic basket of limes and green chillies, shiny unbranded vintage pale yellow bottle of dish soap and green sponge, curated cooking kit with three tiny packets and coconut milk tin. Graphic packaging tasteful and uncluttered with generic labels only. No outside text, captions, figures, borders, human figures or logos. Exact symmetric 4 by 3 grid; no product spans cells.

## GitHub Pages demo

The Pages demo reuses the store logic with an in-browser SQLite database. Its test orders, inventory changes, customer enquiries and demo dashboard are isolated to the current tab. Try it with fictional details.

To build the demo, run `npm ci --prefix pages --ignore-scripts` and `node pages/build.mjs`. The generated `dist-pages/` directory is the static publication source. The full server-backed project remains available in this repository.
