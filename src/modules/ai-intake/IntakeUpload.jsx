import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';

export default function IntakeUpload({ onParse, parsing }) {
  const [rawText, setRawText] = useState('');
  const [sourceType, setSourceType] = useState('email');

  function submit(e) {
    e.preventDefault();
    if (!rawText.trim()) return;
    onParse({ source_type: sourceType, raw_text: rawText });
    setRawText('');
  }

  return (
    <form onSubmit={submit} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Intake Upload</div>
      <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
        <option value="email">email</option>
        <option value="pdf">pdf</option>
        <option value="manual">manual</option>
      </select>
      <textarea rows={6} value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste RFQ email, PO, or spec text" />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" loading={parsing}>Parse</Button>
      </div>
    </form>
  );
}
