# API Inventory

Generated from `https://api.deadlock-api.com/openapi.json` at 2026-10-04T20:22:29.052Z. Do not edit generated rows by hand.

Endpoint count: **129**

| Method | Path | operationId | Group | Flags | Strategy | Status |
|---|---|---|---|---|---|---|
| GET | `/v1/analytics/ability-order-stats` | `ability_order_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/badge-distribution` | `badge_distribution` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/buff-stats` | `buff_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/build-item-stats` | `build_item_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/game-stats` | `game_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-ban-stats` | `hero_ban_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-build-stats/{hero_id}` | `hero_build_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-comb-stats` | `hero_comb_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-counter-stats` | `hero_counters_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-stats` | `hero_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/hero-synergy-stats` | `hero_synergies_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/item-flow-stats` | `item_flow_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/item-permutation-stats` | `item_permutation_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/item-stats` | `item_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/kill-death-stats` | `kill_death_stats` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/lane-matchup-stats` | `lane_matchup_stats` | Analytics | unstable | runtime | planned |
| GET | `/v1/analytics/lane-soul-curve` | `lane_soul_curve` | Analytics | unstable | runtime | planned |
| GET | `/v1/analytics/player-performance-curve` | `player_performance_curve` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/player-stats/metrics` | `player_stats_metrics` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/scoreboards/heroes` | `hero_scoreboard` | Analytics | — | runtime | planned |
| GET | `/v1/analytics/scoreboards/players` | `player_scoreboard` | Analytics | — | runtime | planned |
| GET | `/v1/assets/accolades` | `list_accolades` | Accolades | — | runtime | planned |
| GET | `/v1/assets/accolades/{accolade_id}` | `get_accolade` | Accolades | — | runtime | planned |
| GET | `/v1/assets/accolades/by-name/{name}` | `get_accolade_by_name` | Accolades | — | runtime | planned |
| GET | `/v1/assets/build-tags` | `list_build_tags` | Build Tags | — | runtime | planned |
| GET | `/v1/assets/build-tags/{build_tag_id}` | `get_build_tag` | Build Tags | — | runtime | planned |
| GET | `/v1/assets/build-tags/by-name/{name}` | `get_build_tag_by_name` | Build Tags | — | runtime | planned |
| GET | `/v1/assets/client-versions` | `list_client_versions` | Client Versions | — | runtime | planned |
| GET | `/v1/assets/colors` | `list_colors` | Colors | — | runtime | planned |
| GET | `/v1/assets/fonts` | `fonts` | Assets Bucket | — | runtime | planned |
| GET | `/v1/assets/generic-data` | `get_generic_data` | Generic Data | — | runtime | planned |
| GET | `/v1/assets/heroes` | `list_heroes` | Heroes | — | runtime | planned |
| GET | `/v1/assets/heroes/{hero_id}` | `get_hero` | Heroes | — | runtime | planned |
| GET | `/v1/assets/heroes/by-name/{name}` | `get_hero_by_name` | Heroes | — | runtime | planned |
| GET | `/v1/assets/icons` | `icons` | Assets Bucket | — | runtime | planned |
| GET | `/v1/assets/images` | `images` | Assets Bucket | — | runtime | planned |
| GET | `/v1/assets/items` | `list_items` | Items | — | runtime | planned |
| GET | `/v1/assets/items/{id_or_class_name}` | `get_item` | Items | — | runtime | planned |
| GET | `/v1/assets/items/by-hero-id/{id}` | `get_items_by_hero_id` | Items | — | runtime | planned |
| GET | `/v1/assets/items/by-slot-type/{slot_type}` | `get_items_by_slot_type` | Items | — | runtime | planned |
| GET | `/v1/assets/items/by-type/{type}` | `get_items_by_type` | Items | — | runtime | planned |
| GET | `/v1/assets/loot-tables` | `list_loot_tables` | Loot Tables | deprecated | ignore | planned |
| GET | `/v1/assets/map` | `get_map` | Map | — | runtime | planned |
| GET | `/v1/assets/misc-entities` | `list_misc_entities` | Misc Entities | — | runtime | planned |
| GET | `/v1/assets/misc-entities/{id_or_classname}` | `get_misc_entity` | Misc Entities | — | runtime | planned |
| GET | `/v1/assets/modifiers` | `list_modifiers` | Modifiers | — | runtime | planned |
| GET | `/v1/assets/modifiers/{id_or_classname}` | `get_modifier` | Modifiers | — | runtime | planned |
| GET | `/v1/assets/npc-units` | `list_npc_units` | NPC Units | — | runtime | planned |
| GET | `/v1/assets/npc-units/{id_or_classname}` | `get_npc_unit` | NPC Units | — | runtime | planned |
| GET | `/v1/assets/ranked-seasons` | `list_ranked_seasons` | Ranked Seasons | — | runtime | planned |
| GET | `/v1/assets/ranks` | `list_ranks` | Ranks | — | runtime | planned |
| GET | `/v1/assets/ranks/{tier}` | `get_rank` | Ranks | — | runtime | planned |
| GET | `/v1/assets/ranks/{tier}/{subrank}/image` | `subrank_image` | Ranks | — | runtime | planned |
| GET | `/v1/assets/sounds` | `sounds` | Assets Bucket | — | runtime | planned |
| GET | `/v1/assets/steam-info` | `get_steam_info` | Steam Info | — | runtime | planned |
| GET | `/v1/assets/steam-info/all` | `get_all_steam_info` | Steam Info | — | runtime | planned |
| GET | `/v1/builds` | `search_builds` | Builds | — | runtime | planned |
| GET | `/v1/builds/{hero_id}/{build_id}` | `fetch_build_live` | Builds | — | runtime | planned |
| GET | `/v1/builds/by-author/{account_id}` | `fetch_builds_by_author_live` | Builds | — | runtime | planned |
| GET | `/v1/commands/resolve` | `command_resolve` | Commands | — | runtime | planned |
| GET | `/v1/commands/variables/available` | `available_variables` | Commands | — | runtime | planned |
| GET | `/v1/commands/variables/resolve` | `variables_resolve` | Commands | — | runtime | planned |
| GET | `/v1/commands/widgets/versions` | `widget_versions` | Commands | — | runtime | planned |
| GET | `/v1/crosshair/code/image` | `code_image` | Crosshair | — | runtime | planned |
| GET | `/v1/crosshair/code/settings` | `code_settings` | Crosshair | — | runtime | planned |
| GET | `/v1/crosshair/settings/code` | `settings_code` | Crosshair | — | runtime | planned |
| GET | `/v1/crosshair/settings/image` | `settings_image` | Crosshair | — | runtime | planned |
| POST | `/v1/feedback` | `submit_feedback` | Internal | — | runtime | planned |
| GET | `/v1/graphql` | `playground` | GraphQL | — | runtime | planned |
| GET | `/v1/info` | `info` | Info | — | runtime | planned |
| GET | `/v1/info/health` | `health_check` | Info | — | runtime | planned |
| GET | `/v1/leaderboard/{region}` | `leaderboard` | Leaderboard | — | runtime | planned |
| GET | `/v1/leaderboard/{region}/{hero_id}` | `leaderboard_hero` | Leaderboard | — | runtime | planned |
| GET | `/v1/leaderboard/{region}/{hero_id}/raw` | `leaderboard_hero_raw` | Leaderboard | — | runtime | planned |
| GET | `/v1/leaderboard/{region}/raw` | `leaderboard_raw` | Leaderboard | — | runtime | planned |
| GET | `/v1/matches/{match_id}/live/url` | `url` | Matches | — | runtime | planned |
| GET | `/v1/matches/{match_id}/metadata` | `metadata` | Matches | — | runtime | planned |
| GET | `/v1/matches/{match_id}/metadata/raw` | `metadata_raw` | Matches | — | runtime | planned |
| GET | `/v1/matches/{match_id}/salts` | `salts` | Matches | — | runtime | planned |
| GET | `/v1/matches/active` | `active_matches` | Matches | — | runtime | planned |
| GET | `/v1/matches/active/raw` | `active_matches_raw` | Matches | — | runtime | planned |
| POST | `/v1/matches/custom/{lobby_id}/leave` | `leave` | Custom Matches | — | runtime | planned |
| POST | `/v1/matches/custom/{lobby_id}/ready` | `ready_up` | Custom Matches | — | runtime | planned |
| POST | `/v1/matches/custom/{lobby_id}/start` | `start` | Custom Matches | — | runtime | planned |
| POST | `/v1/matches/custom/{lobby_id}/unready` | `unready` | Custom Matches | — | runtime | planned |
| GET | `/v1/matches/custom/{party_id}/match-id` | `get_custom` | Custom Matches | — | runtime | planned |
| POST | `/v1/matches/custom/create` | `create_custom` | Custom Matches | — | runtime | planned |
| GET | `/v1/matches/demo/live/query` | `live_query` | Demo | — | runtime | planned |
| POST | `/v1/matches/demo/query` | `submit` | Demo | — | runtime | planned |
| GET | `/v1/matches/demo/query/{job_id}` | `status` | Demo | — | runtime | planned |
| GET | `/v1/matches/demo/schema` | `schema` | Demo | — | runtime | planned |
| GET | `/v1/matches/live/urls` | `urls` | Matches | — | runtime | planned |
| POST | `/v1/matches/live/urls` | `ingest_urls` | Matches | — | runtime | planned |
| GET | `/v1/matches/metadata` | `bulk_metadata` | Matches | — | runtime | planned |
| GET | `/v1/matches/recently-fetched` | `recently_fetched` | Matches | — | runtime | planned |
| POST | `/v1/matches/salts` | `ingest_salts` | Internal | — | runtime | planned |
| GET | `/v1/patches` | `feed` | Patches | deprecated | ignore | planned |
| GET | `/v1/patches/big-days` | `big_patch_days` | Patches | — | runtime | planned |
| GET | `/v1/patron/steam-accounts` | `list_steam_accounts` | Internal | patreon | runtime | planned |
| POST | `/v1/patron/steam-accounts` | `add_steam_account` | Internal | patreon | runtime | planned |
| DELETE | `/v1/patron/steam-accounts/{account_id}` | `delete_steam_account` | Internal | patreon | runtime | planned |
| PUT | `/v1/patron/steam-accounts/{account_id}` | `replace_steam_account` | Internal | patreon | runtime | planned |
| POST | `/v1/patron/steam-accounts/{account_id}/reactivate` | `reactivate_steam_account` | Internal | patreon | runtime | planned |
| GET | `/v1/players/{account_id}/account-stats` | `account_stats` | Players | patreon | runtime | planned |
| GET | `/v1/players/{account_id}/card` | `card` | Players | patreon | runtime | planned |
| GET | `/v1/players/{account_id}/enemy-stats` | `enemy_stats` | Players | — | runtime | planned |
| GET | `/v1/players/{account_id}/match-history` | `match_history` | Players | — | runtime | planned |
| GET | `/v1/players/{account_id}/mate-stats` | `mate_stats` | Players | — | runtime | planned |
| GET | `/v1/players/{account_id}/mmr-history` | `mmr_history` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/{account_id}/mmr-history/{hero_id}` | `hero_mmr_history` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/{account_id}/rank` | `rank` | Players | — | runtime | planned |
| GET | `/v1/players/{account_id}/rank-predict` | `rank_predict` | Players | deprecated | ignore | planned |
| GET | `/v1/players/{account_id}/rank-predict/image` | `rank_predict_image` | Players | deprecated | ignore | planned |
| GET | `/v1/players/{account_id}/rank/image` | `rank_image` | Players | — | runtime | planned |
| GET | `/v1/players/hero-stats` | `player_hero_stats` | Players | — | runtime | planned |
| GET | `/v1/players/mmr` | `mmr` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/mmr/{hero_id}` | `hero_mmr` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/mmr/distribution` | `mmr_distribution` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/mmr/distribution/{hero_id}` | `hero_mmr_distribution` | MMR | deprecated | ignore | planned |
| GET | `/v1/players/rank` | `rank_batch` | Players | — | runtime | planned |
| GET | `/v1/players/rank-predict/image` | `rank_predict_avg_image` | Players | deprecated | ignore | planned |
| GET | `/v1/players/rank/distribution` | `rank_distribution` | Players | — | runtime | planned |
| GET | `/v1/players/rank/image` | `rank_avg_image` | Players | — | runtime | planned |
| GET | `/v1/players/steam` | `steam` | Steam | — | runtime | planned |
| GET | `/v1/players/steam-search` | `steam_search` | Steam | — | runtime | planned |
| GET | `/v1/sql` | `sql` | SQL | deprecated | ignore | planned |
| GET | `/v1/sql/tables` | `list_tables` | SQL | deprecated | ignore | planned |
| GET | `/v1/sql/tables/{table}/schema` | `table_schema` | SQL | deprecated | ignore | planned |
| GET | `/v2/patches` | `feed` | Patches | — | runtime | planned |
