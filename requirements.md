# Self-Hosted YouTube Replacement — Requirements

## Homelab Constraints

* Hostname: homelab
* Architecture: x86-64 desktop
* Operating system: Lubuntu
* CPU: Intel Core i5-7400
    * 4 cores
    * 4 threads
    * 3.00 GHz base clock
* GPU: Intel HD Graphics 630 integrated graphics
* RAM: approximately 12 GB
* System drive:
    * Samsung SATA SSD
    * approximately 119 GB
    * used for the operating system and system services
* Storage drive:
    * 1 TB HDD
    * mounted at /srv/storage
* Existing persistent application data is stored under /srv/storage.
* Existing services must not be disrupted, including:
    * Self-hosted Google Drive replacement
    * Self-hosted Google Photos replacement with automatic iPhone upload
    * Wowzer Bowser / personal AI infrastructure
    * Scheduled AI jobs and automations
* Tailscale is already used for private remote access.
* This application’s downloaded YouTube and podcast media must have a hard maximum allocation of 256 GB.
* Metadata, thumbnails, watch history, recommendation data, and other lightweight application data do not need to count toward the 256 GB media-file limit.
* The application must operate comfortably alongside the existing workloads on this hardware.
* The application should avoid unnecessary CPU, RAM, disk-I/O, and storage usage.
* High-resolution video is not a priority.
* All downloaded video must be limited to 720p or lower.
* The application must never intentionally download 1080p, 1440p, 4K, or higher-resolution versions when a 720p-or-lower version is available.
* Lower resolutions are acceptable when appropriate or when 720p is unavailable.
* Storage efficiency and reliable playback are more important than maximum visual quality.

## Product Requirements

* Create a self-hosted YouTube replacement focused on:
    * Local playback
    * Automatic downloading
    * Channel discovery
    * Personalized recommendations
    * Podcast consumption
* The application must be a PWA.
* It must work well on:
    * iPhone
    * Mobile browsers
    * Desktop browsers
    * Laptop browsers
* It must have a responsive, mobile-first interface.
* It must be usable remotely through the existing Tailscale network.
* The primary application must have exactly three main pages:
    1. Home
    2. Channels
    3. Podcasts
* Actual video files and video metadata must be treated as separate layers.
* A video must be browsable even when its media file is not stored locally.
* Deleting a media file must not delete:
    * Video metadata
    * Thumbnail information
    * Watch state
    * Watch percentage
    * Historical recommendation data
* The system must maintain persistent viewing history.
* The system must prioritize simple, reliable playback over high-resolution video quality.
* Locally stored videos must use a maximum resolution of 720p.

## Home Page

* Home is the primary personalized video feed.
* Home should contain approximately 40 active video recommendations at a time.
* Watched content should generally leave the active Home feed and be replaced by other content.
* Home must prioritize unwatched videos.
* Home recommendations must be influenced heavily by channel preference.
* Channels the user watches more should receive more Home feed exposure.
* Home should contain a mixture of:
    * Videos from established preferred channels
    * Videos from newly recommended channels
    * Recent uploads
    * Less-established or diversity recommendations
* The feed should continuously replenish as videos are watched or removed.
* Home must display whether each video is:
    * Downloaded
    * Not downloaded
    * Unwatched
    * In progress
    * Watched
* Videos from newly recommended channels should primarily use that channel’s most-viewed unwatched videos.
* Home should not require every displayed video to already be downloaded.
* Selecting an undownloaded video must allow the system to acquire it for local playback.
* Any video acquired for local playback must be downloaded at 720p or lower.
* Selecting an already-downloaded video should allow immediate local playback.
* The ranking system should favor channels with stronger historical engagement.
* Watch percentage should have more recommendation value than simply clicking a video.
* Long videos should not automatically dominate recommendations solely because they generate more raw watch minutes.

## Channels Page

* The Channels page must show all channels known to the system.
* This includes:
    * User-selected/subscribed channels
    * Pre-seeded channels
    * AI-recommended channels
    * Previously evaluated channels
    * Podcast channels
* The initial system should support roughly 100 pre-seeded channels.
* Pre-seeded channels can include channels related to inferred interests even if the user did not explicitly subscribe to them.
* Each channel must have a dedicated channel view.
* The channel view must allow browsing the channel’s content without downloading all of it.
* Available channel videos should display at least:
    * Thumbnail
    * Title
    * Upload date
    * Duration
    * View count when available
    * Watched state
    * Watch percentage when applicable
    * Local download state
* The application should maintain lightweight metadata for as much of each known channel’s catalog as practical.
* A channel’s catalog should remain visible when none of its videos are currently downloaded.
* Any channel can be manually retained regardless of recommendation score.
* Any channel can be removed from normal recommendations.
* Any channel can be converted into or out of a Podcast Channel at any time.
* Changing a channel to Podcast Channel status must not lose its:
    * Watch history
    * Metadata
    * Recommendation history
    * Existing downloaded files
* Manually downloading a video from a channel must respect the 720p maximum resolution.

## Channel Preference Model

* Recommendation preference should primarily exist at the channel level.
* Maintain persistent engagement statistics for every channel.
* At minimum track:
    * Videos presented
    * Videos opened
    * Videos watched
    * Average percentage watched
    * Individual video watch percentage
    * Recent engagement
    * Last interaction
    * Channel source
* Channel source should distinguish at least:
    * User-added
    * Initial seed
    * AI recommendation
    * Podcast
* Channels receiving more meaningful viewing should rank higher.
* Channels repeatedly ignored or abandoned should rank lower.
* The system should maintain approximately the top 10 channels as the strongest preference signal for AI discovery.
* A single successfully watched video must not immediately overwhelm substantial historical evidence from other channels.
* Channel preference should evolve automatically from actual viewing behavior.
* Users must not need to manually like or dislike content for the recommendation engine to work.

## AI Channel Discovery

* Use OpenRouter-accessible AI models for channel discovery.
* Periodically use approximately the user’s top 10 channels as the primary preference context.
* Ask the AI to propose approximately 10 additional YouTube channels likely to interest the user.
* AI recommendations should be treated as candidates, not automatically trusted preferences.
* Recommendation generation should run periodically.
* The exact recommendation cadence must be configurable.
* The system must remember previously evaluated channels.
* Previously rejected or pruned channels must retain historical engagement information.
* The system should avoid repeatedly recommending the same rejected channel without new justification.
* AI discovery is responsible primarily for finding channels, not individually selecting every video in the feed.
* Actual user viewing behavior determines whether an AI-recommended channel survives.

## New Channel Evaluation

* Newly discovered channels must enter an evaluation/trial state.
* For a new channel, identify approximately its 10 most-viewed videos that the user has not already watched.
* The age of these videos is not important.
* It is acceptable if the videos no longer represent the channel’s current style.
* The goal is to expose the user to the channel’s strongest historically popular content.
* Already-watched videos must not be selected for the trial pool.
* Trial videos should be eligible for Home recommendations.
* Trial videos that are downloaded must be limited to 720p or lower.
* Engagement with trial videos should update the channel’s ranking.
* Strong engagement should allow the channel to become an established recommendation source.
* Lack of engagement over a configurable period should cause the channel to be pruned from active recommendations.
* Pruning a channel must not erase historical information about that channel.

## Watch State

* Every video must support:
    * Unwatched
    * In progress
    * Watched
* Playback progress must persist across sessions and devices.
* Store percentage watched.
* A configurable completion threshold should automatically mark a video as watched.
* Watched state must survive deletion of the local media file.
* A video known to have been watched should not be reintroduced as a new recommendation simply because its local file was deleted.
* Watch history must be usable by both:
    * Feed ranking
    * AI channel discovery

## Podcasts Page

* The Podcasts page must contain channels designated as Podcast Channels.
* Podcast Channel is a user-controlled channel mode.
* Any normal channel can be converted into a Podcast Channel at any time.
* Any Podcast Channel can be converted back into a normal channel.
* Podcast Channels must never be automatically pruned because of recommendation score.
* Every new upload from a Podcast Channel must automatically be downloaded.
* Podcast video downloads must be limited to 720p or lower.
* High-resolution podcast video is unnecessary.
* Podcast downloads must have priority over normal recommendation-cache downloads.
* Unwatched Podcast Channel episodes must be protected from normal cache eviction.
* Once a podcast episode is considered finished or watched, its local media file should be eligible for immediate automatic deletion.
* Deleting a finished podcast episode’s media file must preserve:
    * Episode metadata
    * Thumbnail
    * Watch history
    * Completion state
    * Playback history
* Podcast Channel behavior must be independent of whether the recommendation engine currently considers the channel interesting.
* New episodes from Podcast Channels must continue downloading automatically regardless of recommendation score.
* Podcasts must support resuming playback from the previous position.
* The Podcasts page should clearly separate:
    * Unwatched episodes
    * In-progress episodes
    * Completed episodes

## Video Quality

* 720p is the maximum desired video resolution throughout the application.
* High-quality streaming is not a goal.
* Downloaded media should use 720p where practical.
* Resolutions below 720p are acceptable.
* 1080p, 1440p, 2160p/4K, and higher-resolution video should not be downloaded when a suitable 720p-or-lower version is available.
* Video quality selection should favor:
    1. 720p
    2. Lower resolutions if 720p is unavailable or inappropriate
* The system should favor reasonable file sizes over high bitrate.
* The system should avoid retaining unnecessarily large media variants.
* Only one primary local video copy should normally be retained per video.
* Audio quality should remain sufficient for normal listening and podcast use.
* The purpose of the quality limit is to:
    * Reduce HDD usage
    * Reduce download bandwidth
    * Reduce disk I/O
    * Reduce unnecessary transcoding
    * Increase the number of videos that can fit inside the 256 GB media cache

## Local Media Storage

* Allocate a maximum of 256 GB of the 1 TB HDD to downloaded YouTube and podcast media.
* The application must enforce the storage limit automatically.
* The 256 GB limit must be treated as a hard ceiling.
* The application should normally remain below the hard ceiling to leave space for incoming downloads.
* Storage management must function as a rotating media cache, not an unlimited archive.
* Videos may be automatically deleted when storage needs to be reclaimed.
* Cache cleanup should preferentially remove low-value content.
* General deletion priority should favor removing:
    * Watched normal videos
    * Videos belonging to pruned channels
    * Ignored trial or recommendation videos
    * Older low-ranked normal videos
* Podcast Channel episodes that are still unwatched or in progress must have higher storage priority than ordinary cached recommendations.
* Manually protected or pinned individual videos must not be automatically deleted.
* If new protected Podcast Channel content needs space, ordinary cached recommendation videos should be removed before protected unwatched podcast content.
* Local media deletion must never destroy the corresponding logical video record.
* The 720p resolution limit applies to all media counted against this storage allocation.

## Download Behavior

* Normal channels should not automatically require every video to be downloaded.
* The system should selectively download content useful to the current feed.
* Established normal channels should have a limited rotating collection of locally available unwatched videos.
* Newly recommended channels should be allowed a trial collection based on their top-viewed unwatched videos.
* Podcast Channels must automatically download every new upload.
* Download state must be visible in the UI.
* The user must be able to manually request a download.
* Every automatic or manual video download must be 720p or lower.
* The user must be able to manually remove a downloaded file without removing the video’s metadata or watch history.
* The user must be able to protect or pin an individual downloaded video against automatic deletion.
* The application should not automatically download multiple quality variants of the same video.
* Download behavior should prioritize storage efficiency and reliable playback rather than maximum video quality.

## Playback

* Downloaded videos should play locally from the homelab.
* Playback must work through the PWA on supported mobile and desktop browsers.
* Playback position must persist.
* Playback progress must update the video’s watch percentage.
* Playback should work efficiently without requiring unnecessary transcoding whenever possible.
* Local playback quality does not need to exceed 720p.
* The system should prefer directly playable formats compatible with the intended PWA clients where practical.
* High-bitrate or high-resolution playback is not required.
* Podcast playback must support normal pause and resume behavior.

## Metadata Library

* The logical video library must be substantially larger than the physical downloaded-media library.
* Channel pages should remain useful even if most videos are not downloaded.
* Metadata should be kept locally for known videos whenever practical.
* Thumbnail and title browsing should not require downloading the associated video.
* The application should remember videos it has previously encountered.
* The system must maintain stable video identity so the same YouTube video is not treated as new after its local file is deleted and rediscovered.
* Deleting a 720p local media copy must not affect the metadata record.

## User Controls

* The user must be able to:
    * Add a channel
    * Remove a channel
    * Convert a channel to Podcast Channel
    * Convert a Podcast Channel back to normal
    * Pin or protect a channel from recommendation pruning
    * Pin or protect an individual video from storage cleanup
    * Manually mark videos watched
    * Manually mark videos unwatched
    * Manually delete local media
    * Manually download an available video
* Manual downloads must still obey the 720p maximum resolution.
* Important retention and recommendation thresholds should be configurable rather than permanently hard-coded.

## Core Product Principle

* AI decides what new channels are worth testing.
* User behavior decides which channels survive.
* Channel preference decides what dominates Home.
* The metadata catalog determines what can be browsed.
* The 256 GB rotating cache determines what is immediately available locally.
* Podcast Channel status determines what must always be automatically acquired regardless of recommendation score.
* The system prioritizes availability, storage efficiency, and simplicity over high video quality.
* 720p is the maximum required video quality.
