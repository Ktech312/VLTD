"use client";

export default function ImageUploader({ onAdd }) {
  return (
    <input
      type="file"
      multiple
      accept="image/*"
      onChange={(e) => {
        const files = Array.from(e.target.files || []);
        onAdd(files);
      }}
    />
  );
}
