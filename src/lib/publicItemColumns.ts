// The only vault_items columns public pages are allowed to download.
// Never add notes, purchase_*, storage_location, serial_number, order_number or
// other private fields here: anything selected is readable in the visitor's
// browser even when the screen never shows it.
export const PUBLIC_ITEM_COLUMNS = [
  "id",
  "profile_id",
  "title",
  "subtitle",
  "number",
  "grade",
  "universe",
  "category",
  "custom_category_label",
  "category_label",
  "subcategory_label",
  "subject",
  "year",
  "condition",
  "brand",
  "edition",
  "variant",
  "tags",
  "description",
  "cert_number",
  "is_first_edition",
  "status",
  "is_public",
  "is_new",
  "created_at",
  "image_front_url",
  "image_front_storage_path",
  "image_back_url",
  "primary_image_key",
  "images_json",
].join(", ");

// Public profile and market pages show an item's value on purpose.
export const PUBLIC_ITEM_COLUMNS_WITH_VALUE = `${PUBLIC_ITEM_COLUMNS}, current_value`;

// Invite links can grant "financial history": only then do value and cost columns come along.
export const PUBLIC_ITEM_COLUMNS_FINANCIAL = `${PUBLIC_ITEM_COLUMNS}, current_value, purchase_price`;
