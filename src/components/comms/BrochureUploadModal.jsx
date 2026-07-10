import React, { useState } from "react";
import Btn from "../Btn.jsx";
import Modal from "../form/Modal.jsx";

export default function BrochureUploadModal({ isOpen, onClose, itemType = "project", itemId, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!validTypes.includes(f.type)) {
      setError("Only PDF and images (JPG, PNG) allowed");
      return;
    }
    
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB");
      return;
    }
    
    setFile(f);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    try {
      // TODO: Upload to Supabase storage
      // For now, simulate upload
      const url = URL.createObjectURL(file);
      
      // Call parent success handler with URL
      onUploadSuccess?.(url, file.name);
      
      setFile(null);
      onClose();
    } catch (err) {
      setError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title={`Upload ${itemType} Document`} onClose={onClose} width={400}>
      <div style={{marginBottom: "1rem"}}>
        <label style={{display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8}}>
          Select File (PDF or Image)
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{width: "100%", padding: "8px", border: "1px solid #D1D9E6", borderRadius: 6}}
        />
      </div>

      {file && (
        <div style={{
          background: "#F7F9FC",
          padding: 10,
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 12
        }}>
          <div><strong>File:</strong> {file.name}</div>
          <div><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
      )}

      {error && (
        <div style={{
          background: "#FAEAEA",
          color: "#B83232",
          padding: 10,
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 12
        }}>
          {error}
        </div>
      )}

      <div style={{display: "flex", gap: 12}}>
        <Btn onClick={handleUpload} variant="gold" disabled={!file || uploading} full>
          {uploading ? "Uploading..." : "Upload"}
        </Btn>
        <Btn onClick={onClose} variant="outline" full>
          Cancel
        </Btn>
      </div>
    </Modal>
  );
}
