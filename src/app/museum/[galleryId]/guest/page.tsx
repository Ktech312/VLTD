import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";

export default async function Page({ params }) {
  const { galleryId } = params;

  // assume existing loaders still exist
  const gallery = await getGallery(galleryId);
  const items = await getItems();

  const model = resolveGuestGalleryViewModel(gallery, items);

  return <GuestGalleryRenderer model={model} />;
}
