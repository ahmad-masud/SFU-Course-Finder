# SFU Course Finder

An interactive web app for browsing Simon Fraser University (SFU) course offerings by semester.  
It uses the public **SFU Course Outlines REST API** through server-side proxy routes to avoid CORS and mixed-content issues.

---

## 🚀 Features

### Browsing and Course Data

- Browse by **Year**, **Term**, and **Department**
- View all **Courses** (number + title) within a department
- Access **Instructor lists** with links to RateMyProfessors
- Open detailed **Course Outlines** in a slide-over view
- Includes **Schedule**, **Grades**, **Texts**, and **Notes**
- Shareable URLs — selections persist via query string parameters

### Filters

- Search by **title**, **number**, or **number prefix**
- Filter by **Online only**, **W/Q/B (Breadth)** designations
- Filter by **Campus** (Burnaby, Surrey, Vancouver, Harbour Centre)
- Filter by **Time of day** (morning, afternoon, evening)
- Pagination and items-per-page support
- Shimmer loading and live announcements when evaluating metadata

### Sections and Outlines

- “View Sections” modal per course
- Filtered sections matching top-level filters
- View outline or **Add to Schedule** directly

### Weekly Schedule

- Visual **Mon–Sun grid (8:00–21:00)** for class meetings
- “Courses in schedule” list for online/asynchronous sections
- Clear schedule button
- Schedule saved locally in your browser via `localStorage`

### Accessibility

- Skip links, ARIA semantics, and keyboard-friendly navigation
- Reduced-motion support for shimmer animations
- Live announcements for filters and schedule changes

---

## 🧩 Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4**
- **Node.js 18+** (20 LTS recommended)
- Server routes proxy the SFU API with caching and timeout logic

Data source: [SFU Course Outlines API](http://www.sfu.ca/bin/wcm/course-outlines)

---

## 🧠 API Proxy Endpoints

| Endpoint | Description |
|-----------|--------------|
| `/api/sfu/years` | List available academic years |
| `/api/sfu/terms?year={year|current|registration}` | Terms for a given year |
| `/api/sfu/departments?year={y}&term={t}` | Departments for a term |
| `/api/sfu/courses?year={y}&term={t}&dept={dept}` | Courses for a department |
| `/api/sfu/sections?year={y}&term={t}&dept={dept}&number={num}` | Sections for a course |
| `/api/sfu/outline?year={y}&term={t}&dept={dept}&number={num}&section={sec}` | Course outline details |

All routes proxy the upstream SFU API server-side and return JSON with light caching.

---

## 🧰 Getting Started

### Requirements

- Node.js 18+ (20 LTS recommended)
- npm (comes with Node.js)

### Install and Run Locally

```bash
npm install
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Build and Run for Production

```bash
npm run build
npm start
```

---

## ⚙️ How It Works

### Data Flow

All data is fetched through server-side proxy routes that handle caching and apply timeouts to avoid CORS and network stalls.

- Server timeout: ~12s  
- Client timeout: ~15s

### Filtering

Top-level filters (Online, W/Q/B, Campus, Time of Day) depend on outline metadata.  
The app fetches outlines lazily per visible page, showing shimmer placeholders until evaluation completes.

### Sections & Outlines

- “View Sections” opens a modal filtered by your current selections
- “View Outline” opens a drawer with all course details
- “Add to Schedule” stores selected class times in the weekly grid

### Schedule Persistence

Schedules are stored in `localStorage` under key `sfu_schedule_v1`.  
No data is ever uploaded to a server.

---

## ♿ Accessibility

- Proper dialog semantics and aria-labels
- Live regions announce filter progress and schedule updates
- Full keyboard navigation and focus management
- Motion-safe shimmer animations

---

## 🛠️ Configuration

No environment variables required.

### Relevant Files

- `app/page.tsx` – main UI and schedule
- `app/components/*` – Select, Spinner, Skeleton, Drawer
- `app/api/sfu/*/route.ts` – server proxy routes
- `lib/sfuApi.ts` – fetch wrapper with caching and timeout

---

## 🧩 Troubleshooting

| Issue | Explanation |
|--------|--------------|
| Blank or slow results | SFU API may be intermittent; retry or adjust filters |
| Slow filtering | Some filters require outline metadata; batching is intentional |
| Unknown CSS at-rule warning (`@theme`) | Comes from Tailwind v4, safe to ignore |

---

## 📚 Notes

- Instructor names link to RateMyProfessors (SFU, school id 1482)
- “View course outline on sfu.ca” links to [https://www.sfu.ca/outlines.html](https://www.sfu.ca/outlines.html)
- All data and schedules are local to your browser

---

## 📜 License

MIT License
