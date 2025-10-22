"use client";
import React from "react";
import { Select } from "./components/Select";
import { Spinner } from "./components/Spinner";
import { Skeleton } from "./components/Skeleton";
import { Drawer } from "./components/Drawer";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { label: string; value: string };

// Minimal SFU API types to avoid 'any'
type SfuCourse = {
  value?: string;
  number?: string;
  code?: string;
  courseNumber?: string;
  text?: string;
  title?: string;
  name?: string;
  __dept?: string;
};

type SfuSection = {
  value?: string;
  section?: string;
  sectionCode?: string;
  title?: string;
  text?: string;
  classType?: string; // 'e' enrollment, 'n' non-enrollment
};

type SfuInstructor = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  office?: string;
  officeHours?: string;
  phone?: string;
  profileUrl?: string;
  roleCode?: string;
};

type SfuOutlineScheduleItem = {
  isExam?: boolean;
  days?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  campus?: string;
  sectionCode?: string;
};

type SfuOutlineInfo = {
  name?: string;
  title?: string;
  dept?: string;
  number?: string;
  section?: string;
  units?: string | number;
  term?: string;
  designation?: string;
  deliveryMethod?: string;
  degreeLevel?: string;
  type?: string;
  classNumber?: string;
  outlinePath?: string;
  shortNote?: string;
  instructor?: SfuInstructor[];
  campus?: string;
  prerequisites?: string;
  corequisites?: string;
  gradingNotes?: string;
  description?: string;
  courseDetails?: string;
  departmentalUgradNotes?: string;
  registrarNotes?: string;
  notes?: string;
};

type SfuOutline = SfuOutlineInfo & {
  info?: SfuOutlineInfo;
  schedule?: SfuOutlineScheduleItem[];
  courseSchedule?: SfuOutlineScheduleItem[];
  grading?: Array<{ description?: string; text?: string; weight?: number }>;
  grades?: Array<{ description?: string; text?: string; weight?: number }>;
  requiredText?: unknown[];
  requiredTexts?: unknown[];
  recommendedText?: unknown[];
  text?: unknown;
  texts?: unknown;
};

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(t);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

function toOptions(input: unknown): Option[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: unknown) => {
      if (typeof item === "string" || typeof item === "number") {
        const v = String(item);
        return { label: v.toUpperCase(), value: v.toLowerCase() };
      }
      if (typeof item === "object" && item !== null) {
        const o = item as Record<string, unknown>;
        const value = (o.value ?? o.code ?? o.dept ?? o.department ?? o.number ?? o.term ?? o.text ?? o.name) as unknown;
        const label = (o.text ?? o.title ?? o.name ?? value) as unknown;
        if (value == null) return null;
        return { label: String(label), value: String(value).toLowerCase() };
      }
      return null;
    })
    .filter((x): x is Option => Boolean(x));
}

export default function Home() {
  const [years, setYears] = React.useState<Option[]>([]);
  const [terms, setTerms] = React.useState<Option[]>([]);
  const [depts, setDepts] = React.useState<Option[]>([]);
  const [courses, setCourses] = React.useState<SfuCourse[]>([]);
  const [sections, setSections] = React.useState<SfuSection[]>([]);

  const [year, setYear] = React.useState<string>("");
  const [term, setTerm] = React.useState<string>("");
  const [dept, setDept] = React.useState<string>("");
  const [selectedDepts, setSelectedDepts] = React.useState<string[]>([]);
  const [courseNumber, setCourseNumber] = React.useState<string>("");

  // Course list filters & pagination
  const [searchCourse, setSearchCourse] = React.useState("");
  const [numPrefix, setNumPrefix] = React.useState("");
  const [coursePage, setCoursePage] = React.useState(1);
  const [coursePageSize, setCoursePageSize] = React.useState(20);
  const [courseFilterOnline, setCourseFilterOnline] = React.useState(false);
  const [courseFilterWQB, setCourseFilterWQB] = React.useState<{ W?: boolean; Q?: boolean; BHum?: boolean; BSci?: boolean; BSoc?: boolean }>({});
  const [courseFilterTimeOfDay, setCourseFilterTimeOfDay] = React.useState(""); // morning/afternoon/evening
  const [courseFilterCampus, setCourseFilterCampus] = React.useState<string[]>([]);
  const [courseMetaMap, setCourseMetaMap] = React.useState<Record<string, { hasOnline?: boolean; hasW?: boolean; hasQ?: boolean; hasBHum?: boolean; hasBSci?: boolean; hasBSoc?: boolean; campuses?: string[]; timesOfDay?: string[] }>>({});
  const [courseMetaLoading, setCourseMetaLoading] = React.useState(false);
  const [courseSectionsMap, setCourseSectionsMap] = React.useState<Record<string, SfuSection[]>>({});
  // Sections modal state
  const [sectionsModalOpen, setSectionsModalOpen] = React.useState(false);
  const [sectionsModalCourseKey, setSectionsModalCourseKey] = React.useState<string>("");
  const [sectionsModalCourseLabel, setSectionsModalCourseLabel] = React.useState<string>("");
  const [sectionsModalLoading, setSectionsModalLoading] = React.useState(false);
  const [sectionsModalOutlines, setSectionsModalOutlines] = React.useState<Record<string, SfuOutline>>({});

  // Schedule state (persisted in localStorage)
  type ScheduleItem = {
    id: string;
    dept: string;
    number: string;
    section: string;
    title?: string;
    days: string[]; // e.g., ["Mo","We"]
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
    campus?: string;
    deliveryMethod?: string;
    instructors?: string[];
    color: string; // for rendering
  };
  const [schedule, setSchedule] = React.useState<ScheduleItem[]>([]);
  const [a11yMsg, setA11yMsg] = React.useState<string>("");

  // Color helper for a given course key
  function colorFor(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 50%)`;
  }

  // Time helpers
  function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map((x) => parseInt(x || "0", 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  }
  const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
  function parseDays(days: string): string[] {
    const s = (days || "").replace(/\s+/g, "");
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
      const two = s.slice(i, i + 2);
      if ((DOW as readonly string[]).includes(two)) {
        out.push(two);
        i += 2;
      } else {
        i += 1; // skip unknown char
      }
    }
    return out;
  }

  function extractInstructorNames(ol: unknown): string[] {
    if (!ol) return [];
    const o = ol as SfuOutline;
    const info = o.info ?? o;
    const arr = Array.isArray((o as SfuOutline).instructor)
      ? (o as SfuOutline).instructor
      : Array.isArray(info?.instructor)
      ? info.instructor
      : [];
    if (!Array.isArray(arr)) return [];
    const names = arr
      .map((i: SfuInstructor) => i?.name || [i?.firstName, i?.lastName].filter(Boolean).join(" "))
      .map((s: string | undefined) => String(s || "").trim())
      .filter((s: string) => s.length > 0);
    return Array.from(new Set(names));
  }

  // Load/save schedule in localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("sfu_schedule_v1");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSchedule(arr);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem("sfu_schedule_v1", JSON.stringify(schedule));
    } catch {}
  }, [schedule]);

  function addSectionToSchedule(deptCode: string, courseNum: string, sectionObj: SfuSection | string, outline: unknown) {
    const o = (outline || {}) as SfuOutline;
    const info = o?.info ?? o ?? {};
    const scheduleArr = (o?.schedule ?? o?.courseSchedule ?? []) as SfuOutlineScheduleItem[];
    const campus = scheduleArr.find((s) => !s?.isExam)?.campus || info?.campus;
    const title = info?.name || info?.title || `${deptCode.toUpperCase()} ${courseNum.toUpperCase()}`;
    const deliveryMethod = info?.deliveryMethod || undefined;
    const instructors = extractInstructorNames(outline);
    const color = colorFor(`${deptCode}::${courseNum}`);
    const sec = (typeof sectionObj === 'string' ? sectionObj : (sectionObj?.section || sectionObj?.value || sectionObj)).toString();
    const newItems: ScheduleItem[] = [];
    for (const sch of scheduleArr) {
      if (sch?.isExam) continue;
      const days = parseDays(String(sch?.days || ""));
      const start = String(sch?.startTime || "");
      const end = String(sch?.endTime || "");
      if (!days.length || !start || !end) continue;
      const id = `${deptCode}::${courseNum}::${sec}::${days.join("")}::${start}::${end}`.toLowerCase();
      newItems.push({ id, dept: deptCode, number: courseNum, section: sec, title, days, startTime: start, endTime: end, campus, deliveryMethod, instructors, color });
    }
    if (newItems.length === 0) {
      // Create a placeholder entry so online/asynchronous courses are still tracked
      const id = `${deptCode}::${courseNum}::${sec}::placeholder`.toLowerCase();
      const placeholder: ScheduleItem = { id, dept: deptCode, number: courseNum, section: sec, title, days: [], startTime: "", endTime: "", campus, deliveryMethod, instructors, color };
      setSchedule((prev) => {
        const exists = prev.some((p) => p.id === id);
        if (!exists) setA11yMsg(`Added ${deptCode.toUpperCase()} ${courseNum.toUpperCase()} ${sec} (no scheduled meeting times) to schedule.`);
        return exists ? prev : [...prev, placeholder];
      });
      return;
    }
    setSchedule((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const added = newItems.filter((n) => !ids.has(n.id));
      if (added.length > 0) setA11yMsg(`Added ${deptCode.toUpperCase()} ${courseNum.toUpperCase()} ${sec} to schedule.`);
      return [...prev, ...added];
    });
  }

  function removeCourseFromSchedule(deptCode: string, courseNum: string, section: string) {
    const key = `${deptCode.toLowerCase()}::${courseNum.toLowerCase()}::${section.toLowerCase()}`;
    setSchedule((prev) => {
      const next = prev.filter((it) => `${it.dept.toLowerCase()}::${it.number.toLowerCase()}::${it.section.toLowerCase()}` !== key);
      if (next.length !== prev.length) {
        setA11yMsg(`Removed ${deptCode.toUpperCase()} ${courseNum.toUpperCase()} ${section.toUpperCase()} from schedule.`);
      }
      return next;
    });
  }

  const [loading, setLoading] = React.useState<{ [k: string]: boolean }>({});
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [outline, setOutline] = React.useState<SfuOutline | { error: string } | null>(null);

  // Sections pagination (no course-specific filters)
  const [sectionsPage, setSectionsPage] = React.useState(1);
  const [sectionsPageSize, setSectionsPageSize] = React.useState(20);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL
  React.useEffect(() => {
    const y = searchParams.get("year") || "";
    const t = searchParams.get("term") || "";
    const d = searchParams.get("dept") || "";
    const n = searchParams.get("number") || "";
    const s = searchParams.get("section") || "";
    if (y) setYear(y);
    if (t) setTerm(t);
    if (d) setDept(d);
    if (n) setCourseNumber(n);
    if (s) {
      // we'll open it after data loads
    }
  }, [searchParams]);

  // Sync URL when selections change
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (term) params.set("term", term);
    if (dept) params.set("dept", dept);
    if (courseNumber) params.set("number", courseNumber);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [year, term, dept, courseNumber, pathname, router]);

  // Load years
  React.useEffect(() => {
    (async () => {
      setLoading((s) => ({ ...s, years: true }));
      try {
  const data = await fetchJson<unknown>("/api/sfu/years");
        const opts = toOptions(data);
        // Add dynamic options up top
        const dynamic = [
          { label: "Current", value: "current" },
          { label: "Registration", value: "registration" },
        ];
        setYears([...dynamic, ...opts]);
      } finally {
        setLoading((s) => ({ ...s, years: false }));
      }
    })();
  }, []);

  // Load terms when year changes
  React.useEffect(() => {
    if (!year) return;
    (async () => {
      setLoading((s) => ({ ...s, terms: true }));
      try {
  const data = await fetchJson<unknown>(`/api/sfu/terms?year=${encodeURIComponent(year)}`);
        const opts = toOptions(data);
        setTerms(opts);
      } finally {
        setLoading((s) => ({ ...s, terms: false }));
      }
    })();
    // Clear downstream
    setTerm("");
    setDept("");
    setDepts([]);
    setCourses([]);
    setSections([]);
    setCourseNumber("");
  }, [year]);

  // Load departments when term set
  React.useEffect(() => {
    if (!year || !term) return;
    (async () => {
      setLoading((s) => ({ ...s, depts: true }));
      try {
  const data = await fetchJson<unknown>(`/api/sfu/departments?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}`);
        const opts = toOptions(data);
        setDepts(opts);
      } finally {
        setLoading((s) => ({ ...s, depts: false }));
      }
    })();
    setDept("");
    setSelectedDepts([]);
    setCourses([]);
    setSections([]);
    setCourseNumber("");
  }, [year, term]);

  // Load courses when dept changes
  // Load courses for single dept or multiple selectedDepts
  React.useEffect(() => {
    if (!year || !term) return;
    // If no explicit department filters, load all departments' courses
    let deptsToLoad = selectedDepts.length > 0 ? selectedDepts : dept ? [dept] : [];
    if (deptsToLoad.length === 0) {
      if (!depts || depts.length === 0) return; // wait until departments load
      deptsToLoad = depts.map((d) => d.value);
    }
    (async () => {
      setLoading((s) => ({ ...s, courses: true }));
      try {
        const BATCH = 10;
  let accum: SfuCourse[] = [];
        for (let i = 0; i < deptsToLoad.length; i += BATCH) {
          const slice = deptsToLoad.slice(i, i + BATCH);
          const results = await Promise.all(
            slice.map((d) => fetchJson<unknown>(`/api/sfu/courses?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}`))
          );
          results.forEach((arr, idx) => {
            const deptCode = slice[idx];
            const list = Array.isArray(arr) ? (arr as SfuCourse[]) : [];
            accum = accum.concat(list.map((c) => ({ ...c, __dept: deptCode })));
          });
        }
        setCourses(accum);
      } finally {
        setLoading((s) => ({ ...s, courses: false }));
      }
    })();
    setCourseNumber("");
    setSections([]);
    setCoursePage(1);
  }, [year, term, dept, selectedDepts, depts]);

  // Load sections when course selected
  React.useEffect(() => {
    if (!year || !term || !dept || !courseNumber) return;
    (async () => {
      setLoading((s) => ({ ...s, sections: true }));
      try {
        const data = await fetchJson<SfuSection[]>(
          `/api/sfu/sections?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(dept)}&number=${encodeURIComponent(courseNumber)}`
        );
        const arr = Array.isArray(data) ? data : [];
        setSections(arr);
        setSectionsPage(1);
      } finally {
        setLoading((s) => ({ ...s, sections: false }));
      }
    })();
  }, [year, term, dept, courseNumber]);

  async function openOutline(section: SfuSection | string) {
    setOutline(null);
    setOutlineOpen(true);
    setLoading((s) => ({ ...s, outline: true }));
    try {
      const data = await fetchJson<SfuOutline>(
        `/api/sfu/outline?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(dept)}&number=${encodeURIComponent(
          courseNumber
        )}&section=${encodeURIComponent((typeof section === 'string' ? section : (section?.value || section?.section || '')) as string)}`
      );
      setOutline(data);
    } catch (e) {
      setOutline({ error: String(e) });
    } finally {
      setLoading((s) => ({ ...s, outline: false }));
    }
  }

  // Open outline directly by course row (dept, number, section)
  async function openOutlineFor(d: string, n: string, sectionVal: string) {
    setOutline(null);
    setOutlineOpen(true);
    setLoading((s) => ({ ...s, outline: true }));
    try {
      const data = await fetchJson<SfuOutline>(
        `/api/sfu/outline?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}&section=${encodeURIComponent(sectionVal)}`
      );
      setOutline(data);
    } catch (e) {
      setOutline({ error: String(e) });
    } finally {
      setLoading((s) => ({ ...s, outline: false }));
    }
  }

  // Open a modal listing sections for a course (dept::number)
  async function openSectionsModal(courseValue: string, courseLabel: string) {
    setSectionsModalCourseKey(courseValue);
    setSectionsModalCourseLabel(courseLabel);
    setSectionsModalOutlines({});
    setSectionsModalOpen(true);
    // Ensure sections loaded for this course
    let secsToUse: SfuSection[] | undefined = courseSectionsMap[courseValue];
    if (!secsToUse) {
      const [d, n] = String(courseValue).split("::");
      try {
        const secs = await fetchJson<SfuSection[]>(`/api/sfu/sections?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}`);
        secsToUse = Array.isArray(secs) ? secs : [];
        setCourseSectionsMap((prev) => ({ ...prev, [courseValue]: secsToUse as SfuSection[] }));
      } catch {
        secsToUse = [];
        setCourseSectionsMap((prev) => ({ ...prev, [courseValue]: [] }));
      }
    }
    // Fetch outlines for sections to support filtering (online/campus/time/WQB)
    const secs = secsToUse || [];
    if (secs && secs.length > 0) {
      setSectionsModalLoading(true);
      const [d, n] = String(courseValue).split("::");
      const entries = await Promise.all(
        secs.map(async (s: SfuSection) => {
          const sectionVal = (s?.value || s?.section || "") as string;
          if (!sectionVal) return null;
          try {
            const data = await fetchJson<SfuOutline>(`/api/sfu/outline?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}&section=${encodeURIComponent(sectionVal)}`);
            return [String(sectionVal).toLowerCase(), data] as const;
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, SfuOutline> = {};
      for (const e of entries) {
        if (e && e[0]) map[e[0]] = e[1];
      }
      setSectionsModalOutlines(map);
      setSectionsModalLoading(false);
    }
  }

  // No course-specific outline prefetch needed now

  // Normalize outline shape to handle SFU variants (info, courseSchedule, grades, requiredText)
  type OutlineNormalized = SfuOutlineInfo & {
    schedule: SfuOutlineScheduleItem[];
    grading: Array<{ description?: string; text?: string; weight?: number }>;
    requiredTexts: unknown[];
    instructor?: SfuInstructor[];
    designation?: string;
    deliveryMethod?: string;
    degreeLevel?: string;
    type?: string;
    classNumber?: string;
    outlinePath?: string;
    recommendedText?: unknown;
    text?: unknown;
    texts?: unknown;
    educationalGoals?: string;
  };
  const ol = React.useMemo<OutlineNormalized | null>(() => {
    if (!outline || (typeof outline === 'object' && outline !== null && 'error' in outline)) return null;
    const o = outline as SfuOutline;
    const info = o.info ?? {};
    const schedule = (o.schedule ?? o.courseSchedule ?? []) as SfuOutlineScheduleItem[];
    const grading = (o.grading ?? o.grades ?? []) as Array<{ description?: string; text?: string; weight?: number }>;
    const requiredTexts = (o.requiredText ?? o.requiredTexts ?? o.texts ?? []) as unknown[];
    return { ...o, ...info, schedule, grading, requiredTexts };
  }, [outline]);

  const html = (s?: string) => ({ __html: s || "" });
  // Safely extract HTML-ish text fields from heterogeneous outline text items
  const toTextHtml = (v: unknown): string | null => {
    if (typeof v === "object" && v !== null) {
      const o = v as { details?: unknown; text?: unknown };
      const d = typeof o.details === "string" ? o.details : undefined;
      const t = typeof o.text === "string" ? o.text : undefined;
      const s = d ?? t;
      return typeof s === "string" ? s : null;
    }
    return null;
  };

  const courseOptions: Array<{ label: string; value: string; __dept: string; __title: string; __num: string }> = React.useMemo(() => {
    // Build label and preserve dept tag; ensure unique value per dept+number
    let items = (courses || []).map((c) => {
      const num = (c.value ?? c.number ?? c.code ?? c.courseNumber ?? c.text ?? "").toString();
      const numLower = num.toLowerCase();
      const title = (c.title ?? c.text ?? c.name ?? "").toString();
      const titleLower = title.toLowerCase();
      const deptCode = (c.__dept || dept || "").toString().toUpperCase();
      const value = `${deptCode.toLowerCase()}::${numLower}`;
      const label = `${deptCode} ${num.toUpperCase()}${title ? ` — ${title}` : ""}`;
      return { label, value, __dept: deptCode, __title: titleLower, __num: numLower };
    });
    // Apply search and number prefix filters
    if (searchCourse.trim()) {
      const q = searchCourse.trim().toLowerCase();
      items = items.filter((i) => i.__num.includes(q) || i.__title.includes(q) || i.label.toLowerCase().includes(q));
    }
    if (numPrefix.trim()) {
      const p = numPrefix.trim().toLowerCase();
      items = items.filter((i) => i.__num.startsWith(p));
    }
    // Apply top-level filters (Online, W/Q/B, Campus, Time-of-day). Use meta when available; keep unknown entries so results refine as data loads
    const requiresMeta = courseFilterOnline || courseFilterWQB.W || courseFilterWQB.Q || courseFilterWQB.BHum || courseFilterWQB.BSci || courseFilterWQB.BSoc || courseFilterCampus.length > 0 || Boolean(courseFilterTimeOfDay);
    if (requiresMeta) {
      items = items.filter((i) => {
        const m = courseMetaMap[i.value];
        if (!m) return true; // keep until resolved
        if (courseFilterOnline && !m.hasOnline) return false;
        if (courseFilterWQB.W && !m.hasW) return false;
        if (courseFilterWQB.Q && !m.hasQ) return false;
        if (courseFilterWQB.BHum && !m.hasBHum) return false;
        if (courseFilterWQB.BSci && !m.hasBSci) return false;
        if (courseFilterWQB.BSoc && !m.hasBSoc) return false;
        if (courseFilterCampus.length > 0) {
          const sel = new Set(courseFilterCampus.map((c) => c.toLowerCase()));
          const campuses = (m.campuses || []).map((c) => String(c).toLowerCase());
          if (!campuses.some((c) => sel.has(c))) return false;
        }
        if (courseFilterTimeOfDay) {
          const tod = (m.timesOfDay || []);
          if (!tod.includes(courseFilterTimeOfDay)) return false;
        }
        return true;
      });
    }
    return items;
  }, [courses, dept, searchCourse, numPrefix, courseFilterOnline, courseFilterWQB, courseFilterCampus, courseFilterTimeOfDay, courseMetaMap]);

  const pagedCourseOptions = React.useMemo(() => {
    const start = (coursePage - 1) * coursePageSize;
    return courseOptions.slice(start, start + coursePageSize);
  }, [courseOptions, coursePage, coursePageSize]);

  const totalCoursePages = Math.max(1, Math.ceil(courseOptions.length / coursePageSize));

  // Whether any top-level filters require outline metadata
  const requiresMetaFilters = courseFilterOnline || courseFilterWQB.W || courseFilterWQB.Q || courseFilterWQB.BHum || courseFilterWQB.BSci || courseFilterWQB.BSoc || courseFilterCampus.length > 0 || Boolean(courseFilterTimeOfDay);
  const allMetaLoadedForPage = !requiresMetaFilters || pagedCourseOptions.every((i) => Boolean(courseMetaMap[i.value]));
  const isFilteringInProgress = requiresMetaFilters && !allMetaLoadedForPage && !loading.courses;

  // Fetch course meta (Online/WQB/Campus/Time-of-day) for currently visible page when filters need it
  React.useEffect(() => {
    const requiresMeta = courseFilterOnline || courseFilterWQB.W || courseFilterWQB.Q || courseFilterWQB.BHum || courseFilterWQB.BSci || courseFilterWQB.BSoc || courseFilterCampus.length > 0 || Boolean(courseFilterTimeOfDay);
    if (!requiresMeta) return;
    if (!year || !term) return;
  const list = pagedCourseOptions.filter((i) => !courseMetaMap[i.value]);
    if (list.length === 0) return;
    let cancelled = false;
    (async () => {
      setCourseMetaLoading(true);
      try {
        // Process in small batches to avoid too many requests
  const BATCH = 3;
  type Meta = { hasOnline?: boolean; hasW?: boolean; hasQ?: boolean; hasBHum?: boolean; hasBSci?: boolean; hasBSoc?: boolean; campuses?: string[]; timesOfDay?: string[] };
  const newMap: Record<string, Meta> = {};
        for (let i = 0; i < list.length; i += BATCH) {
          const slice = list.slice(i, i + BATCH);
          await Promise.all(
            slice.map(async (it) => {
              const [d, n] = String(it.value).split("::");
              if (!d || !n) return;
              try {
                const secs = await fetchJson<SfuSection[]>(`/api/sfu/sections?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}`);
                const secArr: SfuSection[] = Array.isArray(secs) ? secs : [];
                // Populate sections map for row display (avoid refetching)
                const key = `${d}::${n}`.toLowerCase();
                setCourseSectionsMap((prev) => (prev[key] ? prev : { ...prev, [key]: secArr }));
                let hasOnline = false;
                let hasW = false, hasQ = false, hasBHum = false, hasBSci = false, hasBSoc = false;
                const campusesSet = new Set<string>();
                const timesSet = new Set<string>();
                // Only check enrollment sections for outlines
                for (const s of secArr) {
                  if (s?.classType && String(s.classType).toLowerCase() !== 'e') continue;
                  const sectionVal = (s?.value || s?.section || "") as string;
                  if (!sectionVal) continue;
                  try {
                    const ol = await fetchJson<SfuOutline>(
                      `/api/sfu/outline?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}&section=${encodeURIComponent(sectionVal)}`
                    );
                    const info = (ol as SfuOutline).info ?? ol;
                    const dm = String(info?.deliveryMethod || "").toLowerCase();
                    if (dm.includes("distance") || dm.includes("online")) hasOnline = true;
                    const des = String(info?.designation || ol?.designation || "").toLowerCase();
                    if (des.includes("writing")) hasW = true;
                    if (des.includes("quantitative")) hasQ = true;
                    if (des.includes("breadth-humanities")) hasBHum = true;
                    if (des.includes("breadth-sciences")) hasBSci = true;
                    if (des.includes("breadth-social")) hasBSoc = true;
                    const schedule = ((ol as SfuOutline)?.schedule ?? (ol as SfuOutline)?.courseSchedule ?? []) as SfuOutlineScheduleItem[];
                    for (const sch of schedule) {
                      if (sch?.isExam) continue;
                      const cp = String(sch?.campus || "").toLowerCase();
                      if (cp) campusesSet.add(cp);
                      const st = String(sch?.startTime || "");
                      const tod = timeOfDay(st);
                      if (tod) timesSet.add(tod);
                    }
                  } catch {}
                  // Early exit if all flags satisfied
                  if ((!courseFilterOnline || hasOnline) && (!courseFilterWQB.W || hasW) && (!courseFilterWQB.Q || hasQ) && (!courseFilterWQB.BHum || hasBHum) && (!courseFilterWQB.BSci || hasBSci) && (!courseFilterWQB.BSoc || hasBSoc)) {
                    // still continue to be safe but could break here
                  }
                }
                newMap[it.value] = { hasOnline, hasW, hasQ, hasBHum, hasBSci, hasBSoc, campuses: Array.from(campusesSet), timesOfDay: Array.from(timesSet) };
              } catch {
                newMap[it.value] = {};
              }
            })
          );
          if (cancelled) return;
          setCourseMetaMap((prev) => ({ ...prev, ...newMap }));
        }
      } finally {
        if (!cancelled) setCourseMetaLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseFilterOnline, courseFilterWQB, courseFilterCampus, courseFilterTimeOfDay, year, term, pagedCourseOptions, courseMetaMap]);

  // Fetch sections for courses in current page (for inline section buttons)
  React.useEffect(() => {
    if (!year || !term) return;
    const list = pagedCourseOptions.filter((i) => !courseSectionsMap[i.value]);
    if (list.length === 0) return;
    let cancelled = false;
    (async () => {
      const BATCH = 4;
      for (let i = 0; i < list.length; i += BATCH) {
        const slice = list.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (it) => {
            const [d, n] = String(it.value).split("::");
            if (!d || !n) return;
            try {
              const secs = await fetchJson<SfuSection[]>(`/api/sfu/sections?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(d)}&number=${encodeURIComponent(n)}`);
              if (cancelled) return;
              setCourseSectionsMap((prev) => ({ ...prev, [it.value]: Array.isArray(secs) ? secs : [] }));
            } catch {
              if (cancelled) return;
              setCourseSectionsMap((prev) => ({ ...prev, [it.value]: [] }));
            }
          })
        );
      }
    })();
    return () => { cancelled = true; };
  }, [year, term, pagedCourseOptions, courseSectionsMap]);

  function timeOfDay(start?: string) {
    if (!start) return "";
    // Expect HH:MM or H:MM
    const [hStr] = start.split(":");
    const h = parseInt(hStr || "0", 10);
    if (isNaN(h)) return "";
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  function hasWQB(desig: string | undefined, key: "W" | "Q" | "BHum" | "BSci" | "BSoc") {
    if (!desig) return false;
    const d = desig.toLowerCase();
    if (key === "W") return d.includes("writing");
    if (key === "Q") return d.includes("quantitative");
    if (key === "BHum") return d.includes("breadth-humanities");
    if (key === "BSci") return d.includes("breadth-sciences");
    if (key === "BSoc") return d.includes("breadth-social");
    return false;
  }
  const pagedSections = React.useMemo(() => {
    const start = (sectionsPage - 1) * sectionsPageSize;
    return sections.slice(start, start + sectionsPageSize);
  }, [sections, sectionsPage, sectionsPageSize]);

  const totalSectionsPages = Math.max(1, Math.ceil(sections.length / sectionsPageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Select
          label="Year"
          value={year}
          onChange={setYear}
          options={years}
          placeholder={loading.years ? "Loading years..." : "Pick a year"}
        />
        <Select
          label="Term"
          value={term}
          onChange={setTerm}
          options={terms}
          placeholder={loading.terms ? "Loading terms..." : year ? "Pick a term" : "Select year first"}
          disabled={!year}
        />
        <Select
          label="Department"
          value={dept}
          onChange={setDept}
          options={depts}
          placeholder={loading.depts ? "Loading depts..." : term ? "Pick a department" : "Select term first"}
          disabled={!year || !term}
        />
        <Select
          label="Course"
          value={courseNumber ? `${(dept || (selectedDepts[0] || "")).toLowerCase()}::${courseNumber.toLowerCase()}` : ""}
          onChange={(v) => {
            const [d, n] = v.split("::");
            if (d) setDept(d);
            setCourseNumber(n || "");
          }}
          options={courseOptions}
          placeholder={loading.courses ? "Loading courses..." : "Pick a course"}
          disabled={!year || !term}
        />
      </div>

      {/* Department filter list & course filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs disabled:opacity-50"
            disabled={!dept}
            onClick={() => {
              if (!dept) return;
              if (!selectedDepts.includes(dept)) setSelectedDepts((arr) => [...arr, dept]);
            }}
          >
            Add department filter
          </button>
          {selectedDepts.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs">
              <span className="font-medium">{d.toUpperCase()}</span>
              <button className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" onClick={() => setSelectedDepts((arr) => arr.filter((x) => x !== d))}>
                ×
              </button>
            </span>
          ))}
          {selectedDepts.length > 0 && (
            <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedDepts([])}>Clear all</button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Search courses</span>
            <input
              value={searchCourse}
              onChange={(e) => { setSearchCourse(e.target.value); setCoursePage(1); }}
              placeholder="e.g. algorithms or 310"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Course number starts with</span>
            <input
              value={numPrefix}
              onChange={(e) => { setNumPrefix(e.target.value); setCoursePage(1); }}
              placeholder="e.g. 1 (shows 1xx)"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Items per page</span>
            <select
              value={coursePageSize}
              onChange={(e) => { setCoursePageSize(parseInt(e.target.value, 10)); setCoursePage(1); }}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {/* Top-level advanced filters */}
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={courseFilterOnline} onChange={(e) => { setCourseFilterOnline(e.target.checked); setCoursePage(1); }} />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Online only</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300">(may be slow)</span>
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">WQB:</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300">(may be slow)</span>
            {([
              {k:'W', label:'W'},
              {k:'Q', label:'Q'},
              {k:'BHum', label:'B-Hum'},
              {k:'BSci', label:'B-Sci'},
              {k:'BSoc', label:'B-Soc'},
            ] as Array<{k: 'W'|'Q'|'BHum'|'BSci'|'BSoc'; label: string}>).map((o) => (
              <label key={o.k} className="inline-flex items-center gap-1">
                <input type="checkbox" checked={Boolean((courseFilterWQB as Record<'W'|'Q'|'BHum'|'BSci'|'BSoc', boolean>)[o.k])} onChange={(e) => setCourseFilterWQB((prev) => ({...prev, [o.k]: e.target.checked}))} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Time of day <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">(may be slow)</span></span>
            <select value={courseFilterTimeOfDay} onChange={(e) => { setCourseFilterTimeOfDay(e.target.value); setCoursePage(1); }} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm">
              <option value="">Any</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Campus <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">(may be slow)</span></span>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {['Burnaby','Surrey','Vancouver','Harbour Centre'].map((camp) => (
                <label key={camp} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={courseFilterCampus.includes(camp)}
                    onChange={(e) => {
                      setCourseFilterCampus((prev) => {
                        if (e.target.checked) return Array.from(new Set([...prev, camp]));
                        return prev.filter((x) => x !== camp);
                      });
                      setCoursePage(1);
                    }}
                  />
                  <span>{camp}</span>
                </label>
              ))}
            </div>
          </div>
          {(courseFilterOnline || courseFilterWQB.W || courseFilterWQB.Q || courseFilterWQB.BHum || courseFilterWQB.BSci || courseFilterWQB.BSoc || courseFilterCampus.length > 0 || Boolean(courseFilterTimeOfDay)) && (
            <div role="status" aria-live="polite" className="text-xs text-zinc-600 dark:text-zinc-400 md:col-span-2">
              Applying top-level filters. {courseMetaLoading ? 'Loading details…' : 'Results refine as details load.'}
            </div>
          )}
        </div>
      </div>
      

      {/* Results */}
      <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold">
            {courseNumber ? `${dept.toUpperCase()} ${courseNumber.toUpperCase()} sections` : "Available courses & sections"}
          </h2>
          <div className="flex items-center gap-2">
            {courseNumber && (
              <button
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                onClick={async () => {
                  const url = window.location.href;
                  try {
                    await navigator.clipboard.writeText(url);
                    alert("Link copied to clipboard.");
                  } catch {
                    prompt("Copy this link", url);
                  }
                }}
              >
                Copy link
              </button>
            )}
            {loading.sections && <Spinner />}
          </div>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {!year || !term ? (
            <div className="p-6 text-sm text-zinc-600">Choose a year and term to see courses.</div>
          ) : !courseNumber ? (
            <>
              <ul className="max-h-[60vh] divide-y divide-black/10 dark:divide-white/10 overflow-y-auto" aria-busy={Boolean(loading.courses || isFilteringInProgress)}>
                {!loading.courses && isFilteringInProgress && (
                  <>
                    {Array.from({ length: coursePageSize }).map((_, i) => (
                      <li key={`sk-filter-${i}`} className="flex items-center justify-between p-3">
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="mt-2 h-3 w-1/3" />
                        </div>
                        <Skeleton className="ml-3 h-6 w-24" />
                      </li>
                    ))}
                  </>
                )}
                {!loading.courses && !isFilteringInProgress && pagedCourseOptions.map((c) => (
                  <li key={c.value} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{c.label}</span>
                    </div>
                    <button
                      className="ml-3 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      aria-haspopup="dialog"
                      aria-controls="sections-modal"
                      onClick={() => openSectionsModal(c.value, c.label)}
                    >
                      View sections
                    </button>
                  </li>
                ))}
                {loading.courses && (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <li key={`sk-course-${i}`} className="flex items-center justify-between p-3">
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="mt-2 h-3 w-1/3" />
                        </div>
                        <Skeleton className="ml-3 h-6 w-24" />
                      </li>
                    ))}
                  </>
                )}
                {!loading.courses && !isFilteringInProgress && courseOptions.length === 0 && (
                  <li className="p-3 text-sm text-zinc-600">No courses found.</li>
                )}
              </ul>
              {/* Course pagination */}
              {courseOptions.length > 0 && (
                <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-4 py-2 text-xs">
                  <div>
                    Page {coursePage} of {totalCoursePages} — {courseOptions.length} courses
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 disabled:opacity-50"
                      disabled={coursePage <= 1}
                      onClick={() => setCoursePage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 disabled:opacity-50"
                      disabled={coursePage >= totalCoursePages}
                      onClick={() => setCoursePage((p) => Math.min(totalCoursePages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
            <ul className="max-h-[60vh] divide-y divide-black/10 dark:divide-white/10 overflow-y-auto">
              {pagedSections.map((s, idx) => {
                const title = s?.title ?? s?.text ?? "Section";
                const code = (s?.value ?? s?.section ?? s?.sectionCode ?? "").toUpperCase();
                const type = s?.classType === "e" ? "Enrollment" : s?.classType === "n" ? "Non-enrollment" : s?.classType ?? "";
                const secCode = s?.sectionCode ?? "";
                return (
                  <li key={`${code}-${idx}`} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{title}</span>
                        {secCode && (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">{secCode}</span>
                        )}
                        {type && (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-700 dark:text-zinc-200">{type}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{code}</div>
                    </div>
                    <button
                      className="ml-3 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      onClick={() => openOutline(s)}
                    >
                      View outline
                    </button>
                  </li>
                );
              })}
              {loading.sections && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <li key={`sk-sec-${i}`} className="flex items-center justify-between p-3">
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </div>
                      <Skeleton className="ml-3 h-6 w-24" />
                    </li>
                  ))}
                </>
              )}
              {!loading.sections && sections.length === 0 && (
                <li className="p-3 text-sm text-zinc-600">No sections found for this course.</li>
              )}
            </ul>
            {/* Sections pagination */}
            {sections.length > 0 && (
              <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-4 py-2 text-xs">
                <div className="flex items-center gap-3">
                  <span>Page {sectionsPage} of {totalSectionsPages} — {sections.length} sections</span>
                  <label className="flex items-center gap-1">
                    <span>Per page</span>
                    <select value={sectionsPageSize} onChange={(e) => { setSectionsPageSize(parseInt(e.target.value, 10)); setSectionsPage(1); }} className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5">
                      {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 disabled:opacity-50" disabled={sectionsPage <= 1} onClick={() => setSectionsPage((p) => Math.max(1, p - 1))}>Prev</button>
                  <button className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 disabled:opacity-50" disabled={sectionsPage >= totalSectionsPages} onClick={() => setSectionsPage((p) => Math.min(totalSectionsPages, p + 1))}>Next</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Sections Modal */}
      {sectionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="sections-modal-title" id="sections-modal" tabIndex={-1} className="w-full max-w-3xl rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl outline-none">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-3">
              <h3 id="sections-modal-title" className="text-sm font-semibold">Sections — {sectionsModalCourseLabel}</h3>
              <button className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300" onClick={() => setSectionsModalOpen(false)} aria-label="Close sections modal">Close</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-black/10 dark:divide-white/10" aria-busy={sectionsModalLoading}>
              {/* Compute filtered list */}
              {(() => {
                const secs: SfuSection[] = courseSectionsMap[sectionsModalCourseKey] || [];
                const [d, n] = String(sectionsModalCourseKey).split("::");
                const list = secs.filter((s: SfuSection) => !s?.classType || String(s.classType).toLowerCase() === 'e').filter((s: SfuSection) => {
                  const key = String(s?.value || s?.section || s).toLowerCase();
                  const ol = sectionsModalOutlines[key];
                  if (!ol) return true; // keep until resolved
                  const info: SfuOutlineInfo = (ol.info ?? ol) as SfuOutlineInfo;
                  // Online filter
                  if (courseFilterOnline) {
                    const dm = String(info?.deliveryMethod || "").toLowerCase();
                    if (!(dm.includes("distance") || dm.includes("online"))) return false;
                  }
                  // WQB filter
                  const des = String(info?.designation || (ol as SfuOutline)?.designation || "");
                  if (courseFilterWQB.W && !hasWQB(des, 'W')) return false;
                  if (courseFilterWQB.Q && !hasWQB(des, 'Q')) return false;
                  if (courseFilterWQB.BHum && !hasWQB(des, 'BHum')) return false;
                  if (courseFilterWQB.BSci && !hasWQB(des, 'BSci')) return false;
                  if (courseFilterWQB.BSoc && !hasWQB(des, 'BSoc')) return false;
                  // Campus filter
                  if (courseFilterCampus.length > 0) {
                    const set = new Set(courseFilterCampus.map((c) => c.toLowerCase()));
                    const schedule = ((ol as SfuOutline)?.schedule ?? (ol as SfuOutline)?.courseSchedule ?? []) as SfuOutlineScheduleItem[];
                    const ok = schedule.some((sch) => set.has(String(sch?.campus || "").toLowerCase()));
                    if (!ok) return false;
                  }
                  // Time of day filter
                  if (courseFilterTimeOfDay) {
                    const schedule = ((ol as SfuOutline)?.schedule ?? (ol as SfuOutline)?.courseSchedule ?? []) as SfuOutlineScheduleItem[];
                    const ok = schedule.some((sch) => timeOfDay(String(sch?.startTime || "")) === courseFilterTimeOfDay);
                    if (!ok) return false;
                  }
                  return true;
                });
                if (sectionsModalLoading && list.length === 0) {
                  return (
                    <>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`sk-modal-${i}`} className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="mt-2 h-3 w-24" />
                          </div>
                          <Skeleton className="ml-3 h-6 w-28" />
                        </div>
                      ))}
                    </>
                  );
                }
                if (list.length === 0) {
                  return <div className="p-4 text-sm text-zinc-600">No sections match your filters.</div>;
                }
                return (
                  <ul>
                    {list.map((s: SfuSection, idx: number) => {
                      const secRaw = (s?.section || s?.value || s).toString();
                      const sec = secRaw.toUpperCase();
                      const title = s?.title || s?.text || '';
                      const key = String(s?.value || s?.section || s).toLowerCase();
                      const ol = sectionsModalOutlines[key];
                      const names = ol ? extractInstructorNames(ol).slice(0,3) : [];
                      return (
                        <li key={`${sec}-${idx}`} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{sec}</div>
                            {title && <div className="text-xs text-zinc-500">{title}</div>}
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                              {names.length > 0 ? (
                                <span>{names.join(', ')}</span>
                              ) : sectionsModalLoading ? (
                                <Skeleton className="h-3 w-32" />
                              ) : null}
                            </div>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <button
                              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700"
                              onClick={() => {
                                setSectionsModalOpen(false);
                                openOutlineFor(String(d), String(n), secRaw);
                              }}
                            >
                              View outline
                            </button>
                            <button
                              className="rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 px-2 py-1 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                              onClick={async () => {
                                const dd = String(d);
                                const nn = String(n);
                                const keyLower = String(s?.value || s?.section || s).toLowerCase();
                                let outlineData = sectionsModalOutlines[keyLower];
                                if (!outlineData) {
                                  try {
                                    outlineData = await fetchJson<SfuOutline>(`/api/sfu/outline?year=${encodeURIComponent(year)}&term=${encodeURIComponent(term)}&dept=${encodeURIComponent(dd)}&number=${encodeURIComponent(nn)}&section=${encodeURIComponent(secRaw)}`);
                                  } catch {}
                                }
                                addSectionToSchedule(dd, nn, s, outlineData || {});
                              }}
                            >
                              Add to schedule
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Week Schedule (bottom) */}
      <section className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your week schedule</h3>
          <div className="flex items-center gap-2">
            {schedule.length > 0 && (
              <button
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs"
                onClick={() => setSchedule([])}
              >
                Clear schedule
              </button>
            )}
          </div>
        </div>
        <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400">Saved locally in your browser.</p>
        <div aria-live="polite" className="sr-only">{a11yMsg}</div>
        {schedule.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-600">
            Add sections to see them plotted on a weekly grid.
          </div>
        ) : (
          (() => {
            const hoursStart = 8 * 60; // 8:00
            const hoursEnd = 21 * 60; // 21:00
            const totalMin = hoursEnd - hoursStart;
            const byDay: Record<string, ScheduleItem[]> = { Mo: [], Tu: [], We: [], Th: [], Fr: [], Sa: [], Su: [] };
            for (const it of schedule) {
              for (const d of it.days) {
                if (byDay[d]) byDay[d].push(it);
              }
            }
            const dayNames: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
            return (
              <div>
                {/* Header with time gutter */}
                <div className="grid text-xs text-zinc-600" style={{ gridTemplateColumns: '60px repeat(7, minmax(0,1fr))' }}>
                  <div className="py-1 pl-1 text-left">Time</div>
                  {DOW.map((d) => (
                    <div key={d} className="py-1 text-center font-medium">{dayNames[d]}</div>
                  ))}
                </div>
                {/* Grid with time gutter + 7 days */}
                <div className="grid gap-2" style={{ gridTemplateColumns: '60px repeat(7, minmax(0,1fr))' }}>
                  {/* Time gutter (labels) */}
                  <div className="relative h-[560px]" aria-hidden="true">
                    {(() => {
                      const hourLabel = (h: number) => {
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const hh = h % 12 === 0 ? 12 : h % 12;
                        return `${hh} ${ampm}`;
                      };
                      return Array.from({ length: 13 }).map((_, i) => (
                        <div
                          key={`tl-${i}`}
                          className="absolute left-1 -translate-y-1/2 text-[10px] text-zinc-500"
                          style={{ top: `${(i/12)*100}%` }}
                        >
                          {hourLabel(8 + i)}
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Day columns */}
                  {DOW.map((d) => (
                    <div key={d} className="relative h-[560px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      {/* events */}
                      {byDay[d].map((it, idx) => {
                        const top = Math.max(0, (timeToMinutes(it.startTime) - hoursStart) / totalMin) * 100;
                        const height = Math.max(2, (timeToMinutes(it.endTime) - timeToMinutes(it.startTime)) / totalMin * 100);
                        const bg = it.color.includes('hsl(') ? it.color.replace(')', ' / 0.15)') : it.color;
                        return (
                          <div
                            key={`${it.id}-${idx}-${d}`}
                            className="absolute left-1 right-1 overflow-hidden rounded border text-xs shadow-sm"
                            style={{ top: `${top}%`, height: `${height}%`, backgroundColor: bg, borderColor: it.color }}
                            title={`${it.dept.toUpperCase()} ${it.number.toUpperCase()} ${it.section} — ${it.startTime}–${it.endTime}${it.campus ? ` @ ${it.campus}` : ''}`}
                          >
                            <div className="px-1.5 py-1">
                              <div className="truncate font-semibold" style={{ color: 'black' }}>
                                {it.dept.toUpperCase()} {it.number.toUpperCase()} {it.section}
                              </div>
                              <div className="truncate" style={{ color: 'black' }}>{it.startTime}–{it.endTime}</div>
                            </div>
                          </div>
                        );
                      })}
                      {/* hour markers */}
                      {Array.from({ length: 13 }).map((_, i) => (
                        <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ top: `${(i/12)*100}%` }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        )}
      </section>

      {/* Scheduled courses list (including items without meeting times) */}
      {schedule.length > 0 && (
        <section className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-3">
          <h3 className="mb-2 text-sm font-semibold">Courses in schedule</h3>
          {(() => {
            // group by course+section
            const groups = new Map<string, { dept: string; number: string; section: string; title?: string; color: string; items: ScheduleItem[] }>();
            for (const it of schedule) {
              const key = `${it.dept.toLowerCase()}::${it.number.toLowerCase()}::${it.section.toLowerCase()}`;
              if (!groups.has(key)) groups.set(key, { dept: it.dept, number: it.number, section: it.section, title: it.title, color: it.color, items: [] });
              groups.get(key)!.items.push(it);
            }
            const list = Array.from(groups.values()).sort((a, b) => a.dept.localeCompare(b.dept) || a.number.localeCompare(b.number) || a.section.localeCompare(b.section));
            return (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {list.map((g, idx) => {
                  const hasTimes = g.items.some((i) => i.days.length > 0 && i.startTime && i.endTime);
                  const campuses = Array.from(new Set(g.items.map((i) => i.campus).filter(Boolean))) as string[];
                  const delivery = (g.items.find((i) => i.deliveryMethod)?.deliveryMethod || '').toString();
                  const examples = g.items
                    .filter((i) => i.days.length > 0 && i.startTime && i.endTime)
                    .slice(0, 2)
                    .map((i) => `${i.days.join(' ')} ${i.startTime}–${i.endTime}`);
                  const profs = Array.from(new Set(g.items.flatMap((i) => i.instructors || []))).slice(0, 3);
                  return (
                    <li key={`${g.dept}-${g.number}-${g.section}-${idx}`} className="flex items-center justify-between p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                          <span className="truncate">{g.dept.toUpperCase()} {g.number.toUpperCase()} {g.section}</span>
                        </div>
                        {g.title && <div className="text-xs text-zinc-600 dark:text-zinc-400">{g.title}</div>}
                        {profs.length > 0 && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{profs.join(', ')}</div>
                        )}
                        <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                          {hasTimes ? (
                            <span>{examples.join(', ')}{g.items.length > 2 ? `, +${g.items.length - 2} more` : ''}</span>
                          ) : (
                            <span>No scheduled meeting times</span>
                          )}
                          {campuses.length > 0 && <span> · {campuses.join(', ')}</span>}
                          {delivery && <span> · {delivery}</span>}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0">
                        <button
                          className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 text-xs hover:bg-red-100 dark:hover:bg-red-900/50"
                          onClick={() => removeCourseFromSchedule(g.dept, g.number, g.section)}
                          aria-label={`Remove ${g.dept.toUpperCase()} ${g.number.toUpperCase()} ${g.section} from schedule`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>
      )}

      {/* Drawer for outline */}
      <Drawer open={outlineOpen} onClose={() => setOutlineOpen(false)} title="Course Outline" widthClass="max-w-4xl">
        {loading.outline && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Spinner /> <span>Loading outline…</span>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
            </div>
          </div>
        )}
        {(() => {
          const outlineError = outline && typeof outline === 'object' && outline !== null && 'error' in outline ? (outline as { error: string }).error : undefined;
          return !loading.outline && outlineError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{String(outlineError)}</div>
          ) : null;
        })()}
        {!loading.outline && ol && (
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{ol?.name || ol?.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span>{ol?.dept}</span>
                {ol?.number && <span>{String(ol.number).toUpperCase()}</span>}
                {ol?.section && <span>{ol.section}</span>}
                {ol?.units && (
                  <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-medium text-zinc-700 dark:text-zinc-200">{ol.units} units</span>
                )}
                {ol?.term && (
                  <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-medium text-zinc-700 dark:text-zinc-200">{ol.term}</span>
                )}
                {ol?.designation && (
                  <span className="ml-2 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 font-semibold text-amber-800 dark:text-amber-200">
                    {ol.designation}
                  </span>
                )}
                {ol?.deliveryMethod && (
                  <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-700 dark:text-zinc-200">
                    {ol.deliveryMethod}
                  </span>
                )}
                {ol?.degreeLevel && (
                  <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-700 dark:text-zinc-200">
                    {ol.degreeLevel}
                  </span>
                )}
                {ol?.type && (
                  <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-700 dark:text-zinc-200">
                    {ol.type === "e" ? "Enrollment" : ol.type}
                  </span>
                )}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ol?.classNumber && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase text-zinc-500">Class Number</div>
                  <div className="text-sm font-medium">{ol.classNumber}</div>
                </div>
              )}
              {ol?.shortNote && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase text-zinc-500">Short Note</div>
                  <div className="text-sm">{ol.shortNote}</div>
                </div>
              )}
              {ol?.outlinePath && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-[11px] uppercase text-zinc-500">Outline Link</div>
                  <a
                    className="text-sm text-blue-600 hover:underline"
                    href={`https://www.sfu.ca/outlines.html?${ol.outlinePath}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on sfu.ca
                  </a>
                </div>
              )}
            </div>

            {/* Description & Details */}
            {ol?.description && (
              <section>
                <h4 className="mb-1 text-sm font-semibold">Description</h4>
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.description)} />
              </section>
            )}
            {ol?.courseDetails && (
              <section>
                <h4 className="mb-1 text-sm font-semibold">Course Details</h4>
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.courseDetails)} />
              </section>
            )}
            {(ol?.departmentalUgradNotes || ol?.registrarNotes || ol?.notes) && (
              <section className="space-y-3">
                {ol?.departmentalUgradNotes && (
                  <div>
                    <h5 className="mb-1 text-xs font-semibold text-zinc-600">Department Notes</h5>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.departmentalUgradNotes)} />
                  </div>
                )}
                {ol?.registrarNotes && (
                  <div>
                    <h5 className="mb-1 text-xs font-semibold text-zinc-600">Registrar Notes</h5>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.registrarNotes)} />
                  </div>
                )}
                {ol?.notes && (
                  <div>
                    <h5 className="mb-1 text-xs font-semibold text-zinc-600">Notes</h5>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.notes)} />
                  </div>
                )}
              </section>
            )}

            {(ol?.prerequisites || ol?.corequisites) && (
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ol?.prerequisites && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                    <h4 className="mb-1 text-sm font-semibold">Prerequisites</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.prerequisites)} />
                  </div>
                )}
                {ol?.corequisites && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                    <h4 className="mb-1 text-sm font-semibold">Corequisites</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.corequisites)} />
                  </div>
                )}
              </section>
            )}

            {ol?.educationalGoals && (
              <section>
                <h4 className="mb-1 text-sm font-semibold">Learning Goals</h4>
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.educationalGoals)} />
              </section>
            )}

            {/* Instructors */}
            {Array.isArray(ol?.instructor) && ol.instructor.length > 0 && (
              <section>
                <h4 className="mb-2 text-sm font-semibold">Instructor(s)</h4>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ol.instructor.map((i: SfuInstructor, idx: number) => (
                    <li key={idx} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        {(() => {
                          const first = String(i?.firstName ?? "").trim();
                          const last = String(i?.lastName ?? "").trim();
                          const displayName = (i?.name || [first, last].filter(Boolean).join(" ") || "Instructor");
                          const queryName = [first, last].filter(Boolean).join(" ");
                          const rmpUrl = queryName ? `https://www.ratemyprofessors.com/search/professors/1482?q=${encodeURIComponent(queryName)}` : "";
                          return (
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {rmpUrl ? (
                                <a className="hover:underline text-blue-600" href={rmpUrl} target="_blank" rel="noreferrer">
                                  {displayName}
                                </a>
                              ) : (
                                <span>{displayName}</span>
                              )}
                            </div>
                          );
                        })()}
                        {i.roleCode && (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-700 dark:text-zinc-200">
                            {i.roleCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-300">
                        {i.email && (
                          <div>
                            <a className="text-blue-600 hover:underline" href={`mailto:${i.email}`}>{i.email}</a>
                          </div>
                        )}
                        {i.office && <div>Office: {i.office}</div>}
                        {i.officeHours && <div>Hours: {i.officeHours}</div>}
                        {i.phone && <div>Phone: {i.phone}</div>}
                        {i.profileUrl && (
                          <div>
                            <a className="text-blue-600 hover:underline" href={i.profileUrl} target="_blank" rel="noreferrer">Profile</a>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Schedule */}
            {Array.isArray(ol?.schedule) && ol.schedule.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Schedule</h4>
                {/* Classes */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs uppercase text-zinc-500">Classes</div>
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {ol.schedule.filter((s: SfuOutlineScheduleItem) => !s.isExam).map((s: SfuOutlineScheduleItem, idx: number) => (
                      <li key={`c-${idx}`} className="grid grid-cols-1 gap-2 p-3 text-sm sm:grid-cols-4">
                        <div className="font-medium">{s.sectionCode || ""}</div>
                        <div className="text-zinc-700 dark:text-zinc-300">{[s.days, s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : null].filter(Boolean).join(" ")}</div>
                        <div className="text-zinc-700 dark:text-zinc-300">{[s.startDate, s.endDate].filter(Boolean).join(" → ")}</div>
                        <div className="text-zinc-700 dark:text-zinc-300">{s.campus || ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Exams */}
                {ol.schedule.some((s: SfuOutlineScheduleItem) => s.isExam) && (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs uppercase text-zinc-500">Exams</div>
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {ol.schedule.filter((s: SfuOutlineScheduleItem) => s.isExam).map((s: SfuOutlineScheduleItem, idx: number) => (
                        <li key={`e-${idx}`} className="grid grid-cols-1 gap-2 p-3 text-sm sm:grid-cols-4">
                          <div className="font-medium">Exam</div>
                          <div className="text-zinc-700 dark:text-zinc-300">{[s.days, s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : null].filter(Boolean).join(" ")}</div>
                          <div className="text-zinc-700 dark:text-zinc-300">{[s.startDate, s.endDate].filter(Boolean).join(" → ")}</div>
                          <div className="text-zinc-700 dark:text-zinc-300">{s.campus || ""}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Grades */}
            {(Array.isArray(ol?.grading) && ol.grading.length > 0) || ol?.gradingNotes ? (
              <section>
                <h4 className="mb-2 text-sm font-semibold">Grades</h4>
                {Array.isArray(ol?.grading) && ol.grading.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {ol.grading.map((g: { description?: string; text?: string; weight?: number }, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{g.description || g.text}</span>
                        {g.weight ? <span className="text-zinc-600 dark:text-zinc-300"> — {g.weight}%</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {ol?.gradingNotes && (
                  <div className="mt-2 prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(ol.gradingNotes)} />
                )}
              </section>
            ) : null}

            {/* Required/Recommended Text */}
            {(ol?.requiredTexts && Array.isArray(ol.requiredTexts) && ol.requiredTexts.length > 0) || ol?.recommendedText || ol?.text || ol?.texts ? (
              <section>
                <h4 className="mb-1 text-sm font-semibold">Required and Recommended Text</h4>
                <ul className="space-y-2 text-sm">
                  {(
                    (Array.isArray(ol?.requiredTexts) && ol.requiredTexts) ||
                    (Array.isArray(ol?.recommendedText) && ol.recommendedText) ||
                    (Array.isArray(ol?.texts) && ol.texts) ||
                    (Array.isArray(ol?.text) && ol.text) ||
                    []
                  ).map((t: unknown, idx: number) => (
                    <li key={idx} className="text-zinc-800 dark:text-zinc-200">
                      {toTextHtml(t) ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={html(toTextHtml(t) || "")} />
                      ) : (
                        <span>{String(t)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Drawer>
    </div>
  );
}
