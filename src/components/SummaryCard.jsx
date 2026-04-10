function SummaryCard({ title, value }) {
  return (
    <div style={{
      border: '1px solid #333',
      padding: 16,
      borderRadius: 10,
      width: 160,
      background: '#1e1e1e',
      color: 'white'
    }}>
      <h4 style={{ margin: 0, fontSize: 14 }}>{title}</h4>
      <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 'bold' }}>
        {value}
      </p>
    </div>
  );
}

export default SummaryCard;