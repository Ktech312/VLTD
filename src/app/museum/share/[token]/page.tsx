import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";

export default async function Page({ params }) {
  const { token } = params;

  const gallery = await getGalleryByToken(token);
  const items = await getItems();

  const model = resolveGuestGalleryViewModel(gallery, items);

  return <GuestGalleryRenderer model={model} />;
}
