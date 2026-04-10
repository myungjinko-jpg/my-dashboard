import { useEffect, useState } from "react";

const SHEET_ID = "1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk";
const SHEET_NAME = "sheet1";

const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

function toNumber(value) {
  return Number(String(value || 0).replace(/[^0-9.]/g, "")) || 0;
}

function avg(arr, key) {
  const valid = arr.filter(v => toNumber(v[key]) > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, v) => sum + toNumber(v[key]), 0) / valid.length;
}

export default function App() {
  const [data, setData] = useState([]);
  const [project, setProject] = useState("");
  const [iteration, setIteration] = useState("");

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(res => {
        const clean = res.filter(r => r.Project && r.Iteration);
        setData(clean);

        const firstProject = clean[0]?.Project;
        setProject(firstProject);
      });
  }, []);

  const projects = [...new Set(data.map(d => d.Project))];

  const projectRows = data.filter(d => d.Project === project);

  const iterations = [...new Set(projectRows.map(d => d.Iteration))];

  useEffect(() => {
    if (iterations.length) setIteration(iterations[0]);
  }, [project]);

  const rows = projectRows.filter(d => d.Iteration === iteration);

  const installsMeta = rows.reduce((sum, r) => sum + toNumber(r["Installs (Meta)"]), 0);
  const installsGa = rows.reduce((sum, r) => sum + toNumber(r["Installs (GA)"]), 0);

  const cpi = avg(rows, "CPI");
  const d1 = avg(rows, "D1 Retention");
  const d0 = avg(rows, "D0 Playtime");
  const d1pt = avg(rows, "D1 Playtime");

  return (
    <div style={{ padding: 20 }}>
      <h1>📊 CPI Dashboard</h1>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 10 }}>
        <select value={project} onChange={e => setProject(e.target.value)}>
          {projects.map(p => <option key={p}>{p}</option>)}
        </select>

        <select value={iteration} onChange={e => setIteration(e.target.value)}>
          {iterations.map(i => <option key={i}>{i}</option>)}
        </select>
      </div>

      {/* KPI */}
      <div style={{ marginTop: 20 }}>
        <div>Meta Installs: {installsMeta}</div>
        <div>GA Installs: {installsGa}</div>
        <div>CPI: ${cpi.toFixed(2)}</div>
        <div>D1: {d1.toFixed(2)}%</div>
        <div>D0 Playtime: {Math.round(d0)} sec</div>
        <div>D1 Playtime: {Math.round(d1pt)} sec</div>
      </div>

      {/* 테이블 */}
      <table border="1" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>CPI</th>
            <th>D1</th>
            <th>Meta</th>
            <th>GA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.Date}</td>
              <td>${toNumber(r.CPI).toFixed(2)}</td>
              <td>{toNumber(r["D1 Retention"]).toFixed(2)}%</td>
              <td>{toNumber(r["Installs (Meta)"])}</td>
              <td>{toNumber(r["Installs (GA)"])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}