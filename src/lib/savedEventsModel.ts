import { createSavedContentStore } from "@/lib/savedContentSync";

const store = createSavedContentStore("vltd_saved_event_ids_v1", "saved_events", "event_id");
export const loadSavedEventIds = store.load;
export const toggleSavedEvent = store.toggle;
export const syncSavedEventIdsFromSupabase = store.sync;
export const pendingSavedEventChanges = store.pendingCount;
