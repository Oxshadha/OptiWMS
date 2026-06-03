# OptiWMS Forecasting Dashboard: Manager Presentation Guide

This document is your cheat-sheet for presenting the OptiWMS Forecasting Dashboard to business leaders, stakeholders, and operations managers. It translates the dashboard visuals into clear, actionable business insights, completely avoiding technical data science jargon.

---

## 1. Demand Forecast vs Actuals — 24-Month View (The "Big Picture" Chart)

**How to explain it to Managers:**
> *"This is our master view of historical demand and future predictions over a 24-month horizon. The solid black line is our 'ground truth'—what actually happened in the warehouse. The teal line shows what our system *would* have predicted back then, proving that it accurately tracks reality. The blue line extending to the right is our projected future demand. The shaded blue area is our 'Safety Net' (Confidence Interval)—it gives us a safe best-case and worst-case scenario so we can plan our buffer stock without guessing."*

---

## 2. 6-Month Forward Forecast (The "Actionable Window" Chart)

**How to explain it to Managers:**
> *"While the previous chart gave us the big picture, this chart zooms in on the next 6 months—our primary operational window. It cuts out the noise and focuses strictly on what we need to procure and staff for *right now*. The muted dashed line shows our underlying baseline trend, so you can see if our overall demand is naturally growing or shrinking beneath the chaotic month-to-month bumps."*

---

## 3. Market Drivers & Promotions (The "Outside Influences" Chart)

**How to explain it to Managers:**
> *"This chart tracks the outside factors that artificially spike or drop our demand, so we know *why* a spike happened. 
> 
> * **Active Campaign (The Bars):** These hit 1.0 (Yes) when we ran a marketing promotion or hit a major holiday. It shows you exactly when a campaign was active.
> * **Weather Demand Impact & Price Index (The Lines):** These are indices. An index of 1.0 means 'Normal'. If the weather line goes up to 1.2, it means the weather naturally boosted our demand by 20%. If our price index drops to 0.9, it means our pricing was 10% lower than the market average. 
> 
> **The Insight:** It helps us answer: 'Did demand spike in July because of a real market trend, or just because we ran a massive promotion during favorable weather?'"*

---

## 4. Seasonality Radar (The "Yearly Cycle" Chart)

**How to explain it to Managers:**
> *"Think of this as our 'Yearly Cycle' map. The further the web stretches out toward a specific month on the outside, the busier that month is relative to our average. If the shape bulges heavily toward November and December, it instantly tells us those are our peak seasons. It’s a quick visual cheat-sheet for planning our warehouse capacity and staffing throughout the year without having to look at complex numbers."*

---

## 5. Model Performance Metrics (KPI Cards at the top)

**How to explain it to Managers:**
> *"These cards at the top are the 'report card' for our forecasting system. 
> 
> * **Accuracy & MAPE (Error Rate):** These tell us that our predictions are usually within a very tight percentage of the actual demand. 
> * **R-Squared:** This confirms how much of our warehouse demand is predictable based on the data we have. 
> 
> **The Insight:** Essentially, these numbers prove to the board that our procurement planning isn't based on gut-feeling anymore—it's a mathematically proven system."*

---

## 6. SKU Demand Velocity vs Model Error (The Scatter Plot)

**How to explain it to Managers:**
> *"This chart helps us instantly identify which specific products are chaotic and hurting our margins. Each dot represents a specific product (SKU). 
> 
> * The further to the **right** a dot is, the faster that product sells (Velocity). 
> * The **higher** a dot is, the worse our AI is at predicting it (High Error). 
> * The **color** indicates whether it's an A, B, or C class item.
> 
> **The Insight:** We want all our dots clustered in the bottom-right corner (fast-selling and highly predictable). If we see massive dots floating in the top-right, it means our fastest-selling cash cows are highly volatile, and we are wasting money storing huge safety buffers just to cover that uncertainty. Those are the specific products we need our team to investigate manually."*
