import { useEffect, useMemo, useState } from 'react';
import SummaryCard from './components/SummaryCard';

const REVIEW_CSV_URL = 'https://docs.google.com/spreadsheets/d/1HP0Ckuqzqf9wQrBtefBJKAkKzOv2fpvtXzAG_uwjvXg/export?format=csv&gid=0';
const ENTRY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1HP0Ckuqzqf9wQrBtefBJKAkKzOv2fpvtXzAG_uwjvXg/export?format=csv&gid=1757209376';

const pageStyle = {
  minHeight: '100vh',
  background: '#0f1117',
  color: '#ffffff',
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
};

const sectionStyle = {
  marginTop: '24px',
};

const filterWrapStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '16px',
};

const selectStyle = {
  background: '#1a1d26',
  color: '#fff',
  border: '1px solid #2d3340',
  borderRadius: '8px',
  padding: '10px 12px',
  minWidth: '150px',
};

const tableWrapStyle = {
  marginTop: '20px',
  overflowX: 'auto',
  border: '1px solid #2d3340',
  borderRadius: '12px',
  background: '#161a22',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '1200px',
};

const thStyle = {
  textAlign: 'left',
  padding: '14px 12px',
  borderBottom: '1px solid #2d3340',
  fontSize: '13px',
  color: '#aab2c0',
  background: '#1b202b',
  position: 'sticky',
  top: 0,
};

const tdStyle = {
  padding: '14px 12px',
  borderBottom: '1px solid #252b36',
  fontSize: '14px',
  verticalAlign: 'top',
};

const linkStyle = {
  color: '#7cc4ff',
  textDecoration: 'none',
};

const badgeStyle = (value) => {
  let bg = '#2b3240';

  if (value === 'Reviewed') bg = '#1f4b35';
  if (value === 'Pending') bg = '#5a4620';
  if (value === 'Shortlisted') bg = '#204a6b';
  if (value === 'Rejected') bg = '#5a2323';

  return {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 'bold',
    background: bg,
    color: '#fff',
    whiteSpace: 'nowrap',
  };
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      row.push(value);
      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (cells[index] || '').trim();
    });
    return obj;
  });
}

function App() {
  const [reviewData, setReviewData] = useState([]);
  const [entrySurveyData, setEntrySurveyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [hcHbFilter, setHcHbFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [studioTierFilter, setStudioTierFilter] = useState('All');
  const [projectTierFilter, setProjectTierFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError('');

        const [reviewRes, entryRes] = await Promise.all([
          fetch(REVIEW_CSV_URL),
          fetch(ENTRY_CSV_URL),
        ]);

        const [reviewText, entryText] = await Promise.all([
          reviewRes.text(),
          entryRes.text(),
        ]);

        const reviewParsed = parseCSV(reviewText).map((row) => ({
          studio: row['Studio'] || '',
          gameTitle: row['Game Title'] || '',
          hcHb: row['HC/HB'] || '',
          updated: row['Updated'] || '',
          manager: row['Manager'] || '',
          managerStatus: row['Manager Status'] || '',
          studioTier: row['Studio Tier'] || '',
          projectTier: row['Project Tier'] || '',
          comment: row['Comment'] || '',
          videoLink: row['video link'] || '',
          portfolioLink: row['portfolio link'] || '',
          testInfo: row['Test Info'] || '',
        }));

        const entryParsed = parseCSV(entryText).map((row) => ({
          studio: row['Studio / Developer Name'] || '',
          contactName: row['Contact Person Name'] || '',
          email: row['Email Address'] || '',
          country: row['Country'] || '',
          teamSize: row['Team Size'] || '',
        }));

        setReviewData(reviewParsed);
        setEntrySurveyData(entryParsed);
      } catch (err) {
        console.error(err);
        setError('Failed to load sheet data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const countryMap = useMemo(() => {
    const map = {};
    entrySurveyData.forEach((entry) => {
      map[entry.studio] = entry.country;
    });
    return map;
  }, [entrySurveyData]);

  const mergedData = useMemo(() => {
    return reviewData.map((review) => ({
      ...review,
      country: countryMap[review.studio] || '-',
    }));
  }, [reviewData, countryMap]);

  const filteredData = useMemo(() => {
    return mergedData.filter((item) => {
      const matchHcHb = hcHbFilter === 'All' || item.hcHb === hcHbFilter;
      const matchManager = managerFilter === 'All' || item.manager === managerFilter;
      const matchStatus = statusFilter === 'All' || item.managerStatus === statusFilter;
      const matchStudioTier = studioTierFilter === 'All' || item.studioTier === studioTierFilter;
      const matchProjectTier = projectTierFilter === 'All' || item.projectTier === projectTierFilter;
      const matchCountry = countryFilter === 'All' || item.country === countryFilter;

      return (
        matchHcHb &&
        matchManager &&
        matchStatus &&
        matchStudioTier &&
        matchProjectTier &&
        matchCountry
      );
    });
  }, [
    mergedData,
    hcHbFilter,
    managerFilter,
    statusFilter,
    studioTierFilter,
    projectTierFilter,
    countryFilter,
  ]);

  const totalEntries = entrySurveyData.length;
  const reviewedProjects = mergedData.filter((item) => item.managerStatus === 'Reviewed').length;
  const pendingReview = mergedData.filter((item) => item.managerStatus === 'Pending').length;
  const shortlistedProjects = mergedData.filter((item) => item.managerStatus === 'Shortlisted').length;
  const uniqueStudios = new Set(entrySurveyData.map((item) => item.studio)).size;

  const hcHbOptions = ['All', ...new Set(mergedData.map((item) => item.hcHb).filter(Boolean))];
  const managerOptions = ['All', ...new Set(mergedData.map((item) => item.manager).filter(Boolean))];
  const statusOptions = ['All', ...new Set(mergedData.map((item) => item.managerStatus).filter(Boolean))];
  const studioTierOptions = ['All', ...new Set(mergedData.map((item) => item.studioTier).filter(Boolean))];
  const projectTierOptions = ['All', ...new Set(mergedData.map((item) => item.projectTier).filter(Boolean))];
  const countryOptions = ['All', ...new Set(mergedData.map((item) => item.country).filter(Boolean))];

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '42px' }}>Challenge Dashboard</h1>
          <p style={{ color: '#aab2c0', marginTop: '12px' }}>Loading sheet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '42px' }}>Challenge Dashboard</h1>
          <p style={{ color: '#ff8a8a', marginTop: '12px' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: '42px' }}>Challenge Dashboard</h1>
        <p style={{ color: '#aab2c0', marginTop: '8px' }}>
          Review status and submission overview for the challenge program
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
          <SummaryCard title="Total Entries" value={totalEntries} />
          <SummaryCard title="Reviewed" value={reviewedProjects} />
          <SummaryCard title="Pending" value={pendingReview} />
          <SummaryCard title="Shortlisted" value={shortlistedProjects} />
          <SummaryCard title="Unique Studios" value={uniqueStudios} />
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Filters</h2>

          <div style={filterWrapStyle}>
            <select style={selectStyle} value={hcHbFilter} onChange={(e) => setHcHbFilter(e.target.value)}>
              {hcHbOptions.map((option) => (
                <option key={option} value={option}>
                  HC/HB: {option}
                </option>
              ))}
            </select>

            <select style={selectStyle} value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
              {managerOptions.map((option) => (
                <option key={option} value={option}>
                  Manager: {option}
                </option>
              ))}
            </select>

            <select style={selectStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  Status: {option}
                </option>
              ))}
            </select>

            <select
              style={selectStyle}
              value={studioTierFilter}
              onChange={(e) => setStudioTierFilter(e.target.value)}
            >
              {studioTierOptions.map((option) => (
                <option key={option} value={option}>
                  Studio Tier: {option}
                </option>
              ))}
            </select>

            <select
              style={selectStyle}
              value={projectTierFilter}
              onChange={(e) => setProjectTierFilter(e.target.value)}
            >
              {projectTierOptions.map((option) => (
                <option key={option} value={option}>
                  Project Tier: {option}
                </option>
              ))}
            </select>

            <select style={selectStyle} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              {countryOptions.map((option) => (
                <option key={option} value={option}>
                  Country: {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>Review Table</h2>
          <p style={{ color: '#aab2c0', marginTop: 0 }}>
            Showing {filteredData.length} project{filteredData.length === 1 ? '' : 's'}
          </p>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Studio</th>
                  <th style={thStyle}>Game Title</th>
                  <th style={thStyle}>HC/HB</th>
                  <th style={thStyle}>Country</th>
                  <th style={thStyle}>Updated</th>
                  <th style={thStyle}>Manager</th>
                  <th style={thStyle}>Manager Status</th>
                  <th style={thStyle}>Studio Tier</th>
                  <th style={thStyle}>Project Tier</th>
                  <th style={thStyle}>Comment</th>
                  <th style={thStyle}>Video</th>
                  <th style={thStyle}>Portfolio</th>
                  <th style={thStyle}>Test Info</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr key={`${item.studio}-${item.gameTitle}-${index}`}>
                    <td style={tdStyle}>{item.studio || '-'}</td>
                    <td style={tdStyle}>{item.gameTitle || '-'}</td>
                    <td style={tdStyle}>{item.hcHb || '-'}</td>
                    <td style={tdStyle}>{item.country || '-'}</td>
                    <td style={tdStyle}>{item.updated || '-'}</td>
                    <td style={tdStyle}>{item.manager || '-'}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(item.managerStatus || '-')}>{item.managerStatus || '-'}</span>
                    </td>
                    <td style={tdStyle}>{item.studioTier || '-'}</td>
                    <td style={tdStyle}>{item.projectTier || '-'}</td>
                    <td style={{ ...tdStyle, minWidth: '240px' }}>{item.comment || '-'}</td>
                    <td style={tdStyle}>
                      {item.videoLink ? (
                        <a href={item.videoLink} target="_blank" rel="noreferrer" style={linkStyle}>
                          Open
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={tdStyle}>
                      {item.portfolioLink ? (
                        <a href={item.portfolioLink} target="_blank" rel="noreferrer" style={linkStyle}>
                          Open
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={tdStyle}>{item.testInfo || '-'}</td>
                  </tr>
                ))}

                {filteredData.length === 0 && (
                  <tr>
                    <td style={tdStyle} colSpan={13}>
                      No data found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;