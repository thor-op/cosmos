'use client';

export default function Galaxies() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#080808' }}>
      <iframe
        src="https://stars.thorxop.dev/"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay"
        title="100,000 Stars"
      />
    </div>
  );
}
