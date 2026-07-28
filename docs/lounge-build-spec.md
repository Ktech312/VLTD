# VLT Lounge Build Spec

## Product Role

VLT Lounge is the community command room. It should not duplicate Discover.

- Discover: browse public exhibitions, collectors, and notable rooms.
- Lounge: discuss, ask, rank, feature, and route community activity.

The first implementation should preserve real-data integrity. If a backend feature is not built, show a premium empty state instead of fake content.

## Visual Rules

- Use the current VLTD dark blue-black, antique gold, cyan value accents, and green success accents.
- Use the newer squared premium pill/button style.
- Do not add a new left rail.
- Do not use old rounded Apple-like pills.
- Do not add purple gradients or gold fog/brown haze.
- Do not stack VLTD logos.

## Sections And Purpose

### Lounge Live

Purpose: The main real-time Lounge feed.

Initial data:
- `activity_events`
- item add/sale/share/exhibition events already used by Activity

Future backend:
- `lounge_posts`
- `lounge_comments`
- `lounge_reactions`

Buttons/icons:
- feed row click: opens the source item, exhibition, or activity record
- kind icon: visual category only, no separate action

### Ask The Lounge

Purpose: Let a collector ask a question without leaving the page.

Initial behavior:
- routes to current community board until post drawer exists

Future backend:
- `lounge_posts.type = question`
- `subject`, `universe`, `item_id`, `gallery_id`
- comments and reactions

UI:
- should open a drawer/modal, not a full page

### Post Update

Purpose: Let a user share a collector update.

Initial behavior:
- admin/creator shortcut until native posting exists

Future post types:
- item question
- market chatter
- exhibition share
- scan result
- milestone
- sale result

### Open Alerts

Purpose: Mail, mentions, replies, and message-like notifications must flow through Alerts.

Initial behavior:
- link to `/notifications`

Future backend:
- reuse existing notifications/alerts if present
- add `lounge_post_id` or `lounge_comment_id` reference columns if needed

### Room Of The Night

Purpose: One curated community feature, not a gallery grid.

Initial data:
- top public gallery by current real public-gallery query

Future backend:
- `lounge_featured_rooms`
- admin curated first
- auto-suggested later

Buttons/icons:
- View Room: opens `/museum/[galleryId]`
- Find Rooms: sends browsing intent to Discover
- Choose Feature: admin shortcut for selecting/creating a feature

### MVP Table

Purpose: Reward useful activity, not only item count.

Initial data:
- existing subject leaderboard RPCs

Future backend:
- `lounge_rank_events`
- score reasons: helpful replies, verified scans, public rooms, price evidence, accepted reports

Rules:
- no fake rankings
- badge by name is acceptable once score/level is real

### Collector Signals

Purpose: Tiny health/pulse metrics for the Lounge.

Initial metrics:
- real activity count
- approved spotlight count
- public room count
- club config count when it exists

Future backend:
- post count today
- replies today
- hot universe
- unresolved questions

### Possible Clubs

Purpose: External community rooms now, native groups later.

Initial behavior:
- one Discord bridge placeholder
- configuration should live in a settings/admin panel

Future backend:
- `lounge_club_links`
- `provider` such as discord
- `invite_url`
- `universe`
- `visibility`

Rules:
- not a left nav item
- club notifications should route through Alerts

### Universe Tables

Purpose: Category-based Lounge areas.

Initial data:
- public room/category activity
- existing community-board subject route

Future backend:
- `lounge_posts.universe`
- unread counts
- pinned posts

### Spotlight Bench

Purpose: Show approved collectors, artists, and brands without making Lounge a directory.

Initial data:
- `spotlights`

Future backend:
- same spotlight admin table can stay source of truth

### Upcoming Lounge Drops

Purpose: Community moments that belong in the Lounge.

Initial behavior:
- empty state until events are approved

Future data:
- approved SerpApi events
- admin-added events
- Discord meetups
- auctions
- community challenges

## Suggested Tables

### lounge_posts

- `id`
- `profile_id`
- `type`
- `title`
- `body`
- `universe`
- `item_id`
- `gallery_id`
- `status`
- `created_at`
- `updated_at`

### lounge_comments

- `id`
- `post_id`
- `profile_id`
- `body`
- `created_at`
- `updated_at`

### lounge_reactions

- `id`
- `post_id`
- `comment_id`
- `profile_id`
- `reaction`
- `created_at`

### lounge_rank_events

- `id`
- `profile_id`
- `reason`
- `points`
- `source_type`
- `source_id`
- `created_at`

### lounge_featured_rooms

- `id`
- `gallery_id`
- `title_override`
- `description_override`
- `starts_at`
- `ends_at`
- `created_by`

### lounge_club_links

- `id`
- `name`
- `provider`
- `invite_url`
- `universe`
- `visibility`
- `enabled`

## Build Order

1. Visual preview approval.
2. Replace `/community-board` with approved Lounge shell.
3. Keep real existing data sources: activity, public rooms, spotlights, leaderboard.
4. Add `lounge_posts` and comments for Ask/Post.
5. Add rank-event scoring.
6. Add Discord club config.
7. Add event/drop feed from approved Events source.
