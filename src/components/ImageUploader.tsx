"use client";

type ImageUploaderProps = {
  onAdd: (files: FileList | null) => void;
};

export default function ImageUploader({ onAdd }: ImageUploaderProps) {
  return (
    <input
      type="file"
      accept="image/*"
      multiple
      onChange={(e) => onAdd(e.target.files)}
      className="block w-full text-sm"
    />
  );
}