export default function renderInlineDelta(delta) {
  if (!delta) return <div className="delta-flat" style={{ fontSize: "14px", marginTop: "4px" }}>Initial</div>;
  return <div className={delta.cls} style={{ fontSize: "14px", marginTop: "4px" }}>{delta.text}</div>;
}
