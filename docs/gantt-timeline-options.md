# Gantt / Timeline component options

The **Trevor Dev Team Timeline** currently uses **react-frappe-gantt**. This doc summarizes alternative options for when we need a different tradeoff (e.g. Chart.js alignment, TV-friendly layout, or read-only “what’s running when” views).

---

## Option A (most “drop-in”): chartjs-plugin-gantt

If you’re happy with a **simple Gantt** (task bars over time) and **no editing**, this is the cleanest path since we already use Chart.js. It supports a time scale and is built for Chart.js.

**When it’s perfect**

- Dashboards
- Status timelines
- “What’s running when” views
- Not a full MS Project clone

**When it’ll start to hurt**

- Dependencies/links between tasks
- Collapsible hierarchies / groups
- Huge datasets + virtualization

---

## Option B (great for TV timelines): react-calendar-timeline

A **timeline** component that handles “items with start/end” really well. It’s not a PM-style Gantt, but for a TV it often looks cleaner and is super readable.

**Use this if the mental model is:**

- “Show rows of work streams with bars across time”

**Not:**

- “Project plan with dependencies and editing”

---

## Option C: SVAR Gantt

A newer **free/modern** Gantt option with PM-style features (dependencies, hierarchy, etc.). Can still be run **read-only**.

Worth a look if we might later want “real Gantt features.”

---

## Enterprise “looks amazing on a TV” (paid)

If budget is fine and we want polished + robust:

- **Highcharts Gantt** – very slick visuals; commercial for production
- **Bryntum Gantt** – high-performance, enterprise-grade

---

## Recommendation for this use case

We already run **PrimeReact + Chart.js** and the timeline is **non-interactive**:

1. **Start with chartjs-plugin-gantt** – fastest to ship, lowest new surface area (same stack as the rest of the charts).
2. If we find ourselves fighting it for layout/grouping/scrolling, **switch to react-calendar-timeline** for a “TV timeline” UX.
3. Consider **Highcharts/Bryntum** only if we need premium polish or long-term scale.
