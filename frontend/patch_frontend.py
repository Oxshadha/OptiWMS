import re

file_path = "/Users/k.e.oshada/Documents/OptiWMS/frontend/app/admin/forecasts/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Remove duplicate CI Bounds toggle
old_ci_toggle = """<label className="label cursor-pointer gap-2 select-none">
                <input 
                  type="checkbox" 
                  className="toggle toggle-primary toggle-xs" 
                  checked={showCI} 
                  onChange={(e) => setShowCI(e.target.checked)} 
                />
                <span className="label-text text-xs font-semibold text-base-content/85">Show CI Bounds</span>
              </label>"""
if old_ci_toggle in content:
    content = content.replace(old_ci_toggle, "")
else:
    print("WARNING: Could not find old CI toggle")

# 2. Rename Model QA to Model Performance
content = content.replace('id: "model", label: "Model QA", icon: "science"', 'id: "model", label: "Model Performance", icon: "science"')
content = content.replace('{/* ── TAB CONTENT: MODEL QA ── */}', '{/* ── TAB CONTENT: MODEL PERFORMANCE ── */}')

# 3. Add Donut Chart component import (PieChart, Pie, Cell)
if "PieChart," not in content and "PieChart" not in content:
    content = content.replace('import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, ReferenceLine, BarChart, Cell, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Brush } from "recharts";',
                              'import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, ReferenceLine, BarChart, Cell, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Brush, PieChart, Pie } from "recharts";')

# 4. Insert Donut Chart next to Model Accuracy Scorecard
donut_chart_code = """
            {/* Inference Path Mix Donut Chart */}
            <div className="card bg-base-100 border border-base-300 p-5 shadow-sm">
              <SectionHeader title="Inference Path Mix" sub="Primary ML model vs. Fallback baseline usage" color={C.ok} />
              <div className="h-56 w-full mt-3 relative flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Primary (Random Forest)", value: 112, color: C.accent },
                        { name: "Fallback (Seasonal Naive)", value: 8, color: C.warn }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {
                        [
                          { name: "Primary (Random Forest)", value: 112, color: C.accent },
                          { name: "Fallback (Seasonal Naive)", value: 8, color: C.warn }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      }
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-base-200 border border-base-300 rounded-lg p-2 shadow-md text-xs">
                          <span className="font-bold" style={{ color: d.color }}>{d.name}</span>: {d.value} runs
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Hole Details */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-accent" style={{ marginTop: '1.5rem' }}>93%</span>
                  <span className="text-[10px] text-base-content/60 font-semibold">SUCCESS RATE</span>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.accent }}></span> Random Forest</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.warn }}></span> Fallback</div>
              </div>
            </div>
"""

# The grid containing the Scorecard was grid-cols-1 lg:grid-cols-2
# Let's change it to lg:grid-cols-3 and insert the donut chart
if 'className="grid grid-cols-1 lg:grid-cols-2 gap-6"' in content:
    # There are multiple instances of this. We want the one containing "Model Target Scorecard"
    scorecard_idx = content.find("Model Target Scorecard")
    if scorecard_idx != -1:
        grid_start = content.rfind('<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">', 0, scorecard_idx)
        if grid_start != -1:
            content = content[:grid_start] + '<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">' + content[grid_start + len('<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">'):]
            
            # Now insert the donut chart after the Area chart
            # The Area Chart ends at </div> </div> and then Scorecard starts.
            # Let's just insert the donut chart right before the Scorecard
            scorecard_card_start = content.rfind('<div className="card bg-base-100 border border-base-300 p-5 shadow-sm">', 0, scorecard_idx)
            content = content[:scorecard_card_start] + donut_chart_code + content[scorecard_card_start:]


with open(file_path, "w") as f:
    f.write(content)
print("✅ Applied frontend patches")
