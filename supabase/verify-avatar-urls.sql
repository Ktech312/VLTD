-- Avatar URL verification helpers.

select id, display_name, avatar_emoji, avatar_url
from profiles
order by updated_at desc nulls last, created_at desc nulls last
limit 25;

select profile_id, display_name, avatar_emoji, avatar_url
from public_profiles
order by updated_at desc nulls last
limit 25;
