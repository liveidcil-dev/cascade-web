# Cascade Management Local Site

Standalone, non-WordPress rebuild for `cascademanagement.us`.

## Run Locally

```bash
npm install
npm start
```

Then open `http://127.0.0.1:4173`.

`npm run dev` is an alias for the same local preview server.

## Cloudflare Pages Deployment

This project is Pages-ready as a static frontend plus a Pages Function.

- Build command: `npm run build` or leave blank.
- Output directory: `public`
- Functions directory: `functions`
- Contact endpoint: `/api/contact`, implemented by `functions/api/contact.js`
- Node server: `server.js` is only for local preview and is not required by Cloudflare Pages.

The frontend uses relative asset paths such as `assets/cascade-mountains.mp4`, so the hero video and property images deploy from the `public/assets/` directory.

## Contact Form Backend Status

The production contact form no longer writes to local JSON. The Cloudflare Pages Function validates and sanitizes the inquiry, returns a successful response, and logs only safe metadata for now.

Next wiring points are marked in `functions/api/contact.js`:

- Resend email notification
- Google Sheets append
- Cloudflare D1 persistence
- Other email or CRM routing

## What This Includes

- Modern one-page marketing site with a real Pexels mountain video loop.
- Services, portfolio, about, housing resources, and contact sections based on the public current website.
- Portfolio filtering without WordPress.
- Cloudflare Pages Function contact endpoint at `/api/contact`.

## Domain and Email Notes

Yes, the original domain can remain. The clean path is to change only the website hosting target while preserving email DNS.

- Keep the registrar account and domain ownership as-is.
- Do not change MX, SPF, DKIM, or DMARC records unless email is being migrated intentionally.
- If changing nameservers, copy the existing email-related DNS records first.
- If keeping the current nameservers, point only the web record, usually the root `A` record and `www` CNAME, to the new hosting provider.
- Keep Bluehost/webmail records untouched until the new site has been tested and email delivery is confirmed.
- WordPress can stay offline, archived, or removed after the new static site is live and verified.

No credentials are needed to build or preview this local version.
