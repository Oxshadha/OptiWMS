"use client";

export function ReceivingQuickActions({
  notes,
  photos,
  onOpenPhotoModal,
  onOpenNoteModal,
  onRemovePhoto,
}: {
  notes: string;
  photos: string[];
  onOpenPhotoModal: () => void;
  onOpenNoteModal: () => void;
  onRemovePhoto: (index: number) => void;
}) {
  return (
    <div className="bg-base-100 rounded-xl p-4 border border-base-300">
      <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onOpenPhotoModal} className="btn btn-outline btn-sm">
          <span className="material-symbols-outlined">photo_camera</span>
          Take Photo
        </button>
        <button onClick={onOpenNoteModal} className="btn btn-outline btn-sm">
          <span className="material-symbols-outlined">note_add</span>
          Add Note
        </button>
      </div>
      {notes && (
        <div className="mt-3 p-3 bg-base-200 rounded-lg">
          <div className="text-xs text-base-content/60 mb-1">Note:</div>
          <div className="text-sm text-base-content">{notes}</div>
        </div>
      )}
      {photos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-base-content/60 mb-2">Photos ({photos.length}):</div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative">
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                <button
                  onClick={() => onRemovePhoto(idx)}
                  className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
