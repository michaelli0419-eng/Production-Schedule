export default function SparkLine({ values = [] }) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / (max - min || 1)) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: 40 }} preserveAspectRatio="none">
      <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={pts} />
    </svg>
  );
}
