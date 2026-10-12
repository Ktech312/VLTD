# Specialist control backlog

These controls are deliberately **not** on the shared pill recipe (`PillButton`, `Toggle`, `PillSelect`). They sit on top of imagery, the 3D scene or a gesture surface, so uniform 44px pills would change layout, movement or dimensions. They are tracked here so the redesign is not described as complete across them.

Rules while on this backlog:
- Museum stays an owner-only Alpha; 3D Gallery stays owner-approved. Do not alter permissions, movement or dimensions to satisfy pill uniformity.
- Each item needs its own design pass and a before/after check on the real surface, not a find-and-replace.
- Ordinary controls inside the same files (menus, dialogs, form fields, toolbars) are already migrated.

| Area | Location | What it is | Why it is held back |
| --- | --- | --- | --- |
| Camera chrome | `src/components/CameraCapturePanel.tsx` (shutter, flash, flip, mode chips over the live preview) | Controls drawn over the camera feed | Sit on live video; sizes tuned for one-handed capture; changing them risks occlusion of the frame |
| 3D HUD | `src/components/gallery/MuseumBuilder.tsx` HUD buttons, `src/components/gallery/VirtualGalleryRoom.tsx` HUD | Heads-up buttons over the 3D scene | Tied to scene movement and camera; owner-only Alpha |
| Wall-image overlay controls | `src/components/GalleryBuilder.tsx` (move, resize, remove on the wall image) | Controls projected on the wall image | Positioned from the image geometry; resizing them changes the layout of the wall |
| Slot overlay | `src/components/gallery/organizeSlots.tsx` (numbered slot circles, empty "+" circles, Remove "−" and Move on a selected slot, scrim behind the Move menu) | Projected overlay on the exhibit wall with drag and touch-hold handlers | Position comes from the wall projection; the Move menu tiles and the Replace/Cancel confirm are already migrated |
| Swipe gestures | `src/components/SwipeStack.tsx` (gesture buttons) | Gesture buttons beside a swipe deck | Paired with the swipe physics |
| Guest gallery arrows | `src/components/gallery/GuestGalleryRenderer.tsx` (previous/next exhibit arrows over the shelf scene) | Round arrows over the scene | Tied to the swipe stepping; only a phone hit area was added |
| Crop handles | `src/components/ScanCropEditor.tsx` (eight crop handles, move surface, pinch/wheel zoom) | Direct-manipulation handles | Handles are the interaction; the editor's buttons are migrated |
| Image viewer overlay | `src/components/ImageViewer.tsx` (prev/next arrows over the image, pan/zoom surface) | Arrows over the image and the gesture surface | Overlay on imagery; arrows have a 44px phone width |
| Museum carousel dots | `src/components/VaultMuseumView.tsx` `SpotlightCard` dots | 6px pagination dots | A 44px hit area on each would overlap its neighbours |
| Inline-edit values | `src/app/vault/item/[id]/page.tsx` (values), `src/components/PricingMvpCard.tsx` (tiles) | Click-to-edit text in dense detail rows | Inline text; each section has a 44px pencil button that performs the same action |
| Card-wide links | `src/app/vault/VaultListView.tsx:502` (title link), `GuestGalleryRenderer` and `VaultMuseumView` card wrappers | Secondary link inside a card that is itself a link to the same page | The whole card is the larger equivalent target |
