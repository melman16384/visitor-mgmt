import { useState, useRef } from 'react';
import SignaturePad from './SignaturePad';
import { Upload, FileText, CheckCircle, X, Eye } from 'lucide-react';
import api from '../api/client';

export default function DocumentSigning({ visitId, onComplete }) {
  const [file, setFile] = useState(null);
  const [docId, setDocId] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload' | 'sign' | 'done'
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('document_type', 'nda');
      const res = await api.post(`/visits/${visitId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocId(res.data.id);
      setStep('sign');
    } catch (e) {
      setError('Upload fehlgeschlagen: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSignatureSave = async (dataURL) => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/documents/${docId}/signature-base64`, { signature: dataURL });
      setStep('done');
      if (onComplete) onComplete();
    } catch (e) {
      setError('Unterschrift konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle size={48} className="text-green-500" />
        <p className="font-semibold text-abat-dunkelgrau">Dokument hochgeladen und unterschrieben</p>
      </div>
    );
  }

  if (step === 'sign') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
          <FileText size={20} className="text-abat-blau" />
          <span className="text-sm font-medium text-abat-dunkelgrau">{file?.name}</span>
          <CheckCircle size={16} className="text-green-500 ml-auto" />
        </div>
        <p className="text-sm text-abat-dunkelgrau">
          Bitte lesen Sie das Dokument und unterzeichnen Sie anschließend unten:
        </p>
        <SignaturePad
          label="Unterschrift (Pflicht)"
          onSave={handleSignatureSave}
        />
        {saving && <p className="text-sm text-abat-grau text-center">Wird gespeichert...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="border-2 border-dashed border-abat-hellgrau rounded-xl p-8 text-center cursor-pointer hover:border-abat-hellblau hover:bg-blue-50 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={32} className="mx-auto mb-3 text-abat-grau" />
        <p className="font-semibold text-abat-dunkelgrau">Dokument hochladen</p>
        <p className="text-sm text-abat-grau mt-1">PDF, DOC oder DOCX — max. 20 MB</p>
        <p className="text-xs text-abat-grau mt-2">Klicken oder Datei hierher ziehen</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      {file && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
          <FileText size={18} className="text-abat-blau" />
          <span className="text-sm text-abat-dunkelgrau flex-1 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-abat-grau hover:text-abat-dunkelgrau">
            <X size={16} />
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="bg-abat-blau text-white py-2.5 px-6 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Wird hochgeladen...' : 'Weiter zur Unterschrift'}
      </button>
    </div>
  );
}
