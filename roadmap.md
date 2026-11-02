# CaféLens — Roadmap

## Done
- [x] Real cafés from Google Maps (499, New Cairo/Fifth Settlement + Sheikh Zayed) with photos, hours, phone, address
- [x] Café directory (/cafes) with search, area filter, sort + detail pages with map

## Phase 2 (from uploaded specs)
- [x] DB review: 499 rows, all source=Google Maps; 349 New Cairo / 140 Zayed / 10 Fifth Settlement; 77 without photos
- [x] Area classification: 6 classes, address-text evidence only (57 Fifth Settlement, 14 NC Other, 288 NC Unclassified, 140 Zayed) — no coordinate guessing
- [x] Structured café attributes table with verification states; seeded only from real Google attributes (439 cafés: group seating / outdoor)
- [x] Menu + prices + per-branch fees tables (sourced, verified) — empty until real menus; no invented prices
- [x] Home page wired to real 499 cafés (discover, categories, tonight pick); old demo data deleted
- [x] Smart Mood Filter: 5 moods as real DB filters, default none, toggle-off + "كل الأجواء", reasons only from confirmed data, honest note when mood data unverified; 6 engine tests passing
- [x] Calculator: real café picker; shows "المنيو والأسعار غير متاحة حاليًا — نعمل على التحقق منها" until a verified menu exists; no fixed 12%/14% fees
- [x] Working nav menu (home, all cafés, areas, calculator, tonight, data quality; compare/map/favorites/account marked قريبًا)
- [x] Data Quality Report page (/data-quality) with real DB counts

## Admin Dashboard (current — from uploaded spec)
- [ ] Google sign-in for staff + role-based access (super_admin/admin/data_manager/content_reviewer/support), RLS + server-side checks
- [ ] Audit log (actor, action, old/new values, reason, source) — immutable
- [ ] Admin dashboard home with real DB counts + data-quality charts
- [ ] Café management: search/filter/sort table, edit, archive
- [ ] Area review page for the 288 unclassified records (reason + source + reviewer per change)
- [ ] Menu & price management per branch with price history (old prices kept)
- [ ] Photo library with license/permission states (approved/pending/rejected/permission_required/expired)
- [ ] Verification center queues (photos, prices, corrections, conflicts)
- [ ] Sources registry
- [ ] Practical tests: unauthorized access blocked, updates reflected on public site, audit entries written

## Open (later)
- [ ] Accounts (email + Google), favorites, visit history, saved baskets, comparisons
- [ ] Group Decision Room (invite link, WhatsApp share, voting)
- [ ] Full English version + RTL/LTR
- [ ] Interactive map of all cafés + open-now filter with post-midnight hours
- [ ] Admin panel to edit area classification and mood criteria weights
- [ ] Real menu sourcing (official menus / owner confirmation / evidenced user reports)
- [ ] Maps embed live verification on deployed origin
- [ ] Performance report (FPS, memory, WebGL fallback)
- [ ] Publish
