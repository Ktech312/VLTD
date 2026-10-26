# Verification record: every demonstrated instruction

Each step below was performed on the deployed app (https://vltd.app) as an isolated synthetic collector, and a check ran at that moment. "Verified" means the check passed; the evidence column is what was read (page text, a link target, a form value or the saved database row). "Simulated" marks anything that is not a real recording of the app doing that thing.

## Chapter 1 — Quick Add

| # | Step | Scene | Verified | Evidence | Simulated |
|---|---|---|---|---|---|
| 1.1 | Start on Home | q-desktop | yes | {"quick":"/vault/quick","add":"/capture"} |  |
| 1.2 | The same buttons are in your Vault | q-desktop | yes | true |  |
| 1.3 | A new, empty Vault offers four starting points | x-map | yes | {"ok":true,"hrefs":{"Scan your first item":["/capture"],"Quick Add":["/vault/quick","/vault/quick"],"Add manually":["/vault/add"],"Import":["/vault/import"]}} |  |
| 1.4 | Upload from device offers two routes | x-map | yes | ["/capture?openUpload=1","/vault/bulk"] |  |
| 1.5 | Add manually is a different, typing-only form | x-map | yes | {"ok":true,"p":"/vault/add"} |  |
| 1.6 | Quick Add opens the camera | q-desktop | yes | {"path":"/vault/quick","feed":"tcg-card"} | The picture in the viewfinder comes from a test camera that plays a synthetic, fictional card picture. The real camera permission prompt is drawn by the browser and cannot be captured. |
| 1.7 | If the camera is blocked | x-denied | yes | true | The permission was set to Blocked in the test browser; the message is the app's own. |
| 1.8 | Optionally pick a Universe first | q-desktop | yes | true |  |
| 1.9 | ...and a Category | q-desktop | yes | {"ok":true,"menu":"Sports Cards Apparel Memorabilia"} |  |
| 1.10 | Press the round button to take a photo | q-desktop | yes | true | Test camera picture (synthetic, fictional card). |
| 1.11 | Keep going: one photo per item | q-desktop | yes | true | Test camera pictures (synthetic, fictional items). |
| 1.12 | Review what you captured | q-desktop | yes | true |  |
| 1.13 | The unwanted photo is gone | q-desktop | yes | true |  |
| 1.14 | Correct a detail before saving | q-desktop | yes | ["Sports","Sports Cards","TCG & Non Sport Card","TCG / CCG","Pop Culture","Toys & Figures"] |  |
| 1.15 | Name each item | q-desktop | yes | ["1992 Hardwood Heroes Javier Alvarez Rookie #14","Aurora Dragon Holo Rare 045/200","Retro Robots Series 2 Action Figure (boxed)"] |  |
| 1.16 | Add what you know | q-desktop | yes | 25 |  |
| 1.17 | Saved: you land in your Vault | q-desktop | yes | {"ok":true,"count":3,"rows":[{"t":"1992 Hardwood Heroes Javier Alvarez Rookie #14","cv":null,"pp":25,"u":"SPORTS","c":"SPORTS_CARDS"},{"t":"Aurora Dragon Holo Rare 045/20 |  |
| 1.18 | Your new items are in the Vault | q-desktop | yes | true |  |
| 1.19 | Search for an item by name | q-desktop | yes | {"ok":true} |  |
| 1.20 | Open the item to check it | q-desktop | yes | {"ok":true,"path":"/vault/item/1793042347719_4li57h"} |  |
| 1.21 | On a phone, the buttons sit at the bottom | q-phone | yes | {"q":"/vault/quick","i":"/capture"} |  |
| 1.22 | Quick Add opens the camera | q-phone | yes | {"path":"/vault/quick"} | The viewfinder shows a test camera playing a synthetic, fictional picture. On a real phone the browser asks to allow the camera first; that prompt cannot be captured. |
| 1.23 | Take one photo per item | q-phone | yes | true | The viewfinder shows a test camera playing a synthetic, fictional picture. On a real phone the browser asks to allow the camera first; that prompt cannot be captured. |
| 1.24 | Remove the photo you do not want | q-phone | yes | true |  |
| 1.25 | Name each item, then save | q-phone | yes | ["1992 Hardwood Heroes Javier Alvarez Rookie #14","Aurora Dragon Holo Rare 045/200","Retro Robots Series 2 Action Figure (boxed)"] |  |
| 1.26 | Back in your Vault | q-phone | yes | {"ok":true,"n":3,"path":"/vault"} |  |

## Chapter 2 — Add Item

| # | Step | Scene | Verified | Evidence | Simulated |
|---|---|---|---|---|---|
| 2.1 | Open Add Item | a-desktop | yes | /capture |  |
| 2.2 | The Add Item form | a-desktop | yes | {"ok":true,"p":"/capture"} |  |
| 2.3 | Save needs an Item name | a-desktop | yes | {"ok":true,"rows":0,"hint":true} |  |
| 2.4 | Take a photo | a-desktop | yes | true | The viewfinder shows a test camera playing a synthetic, fictional toy picture. The browser's own camera permission prompt cannot be captured. |
| 2.5 | Keep the photo or retake it | a-desktop | yes | true | Test camera picture. |
| 2.6 | The photo is on your item | a-desktop | yes | true |  |
| 2.7 | Name it (required) and add what you know | a-desktop | yes | ["Retro Robots Series 2 Action Figure (boxed)","Retro Robots","Series 2"] |  |
| 2.8 | Choose Universe, Category and Subcategory | a-desktop | yes | ["Pop Culture","Toys & Figures","Action Figures"] |  |
| 2.9 | Purchase price is separate from value | a-desktop | yes | ["38.00",""] |  |
| 2.10 | Saved: you land in your Vault | a-desktop | yes | {"ok":true,"cv":null} |  |
| 2.11 | Open it and check | a-desktop | yes | {"ok":true,"p":"/vault/item/1793044875892_k7g5ju"} |  |
| 2.12 | Purchase details live on the item | a-desktop | yes | true |  |
| 2.13 | Add the extra costs | a-desktop | yes | ["38","3.50","4.25","0",""] |  |
| 2.14 | Extra costs saved | a-desktop | yes | {"ok":true,"pp":38,"tax":3.5,"ship":4.25,"fees":0,"cv":null,"src":null} |  |
| 2.15 | Cost and value stay separate | a-desktop | yes | {"ok":true,"cost":"Total cost $45.75"} |  |
| 2.16 | Reload and check it stuck | a-desktop | yes | {"ok":true,"img":true} |  |
| 2.17 | Or upload a photo you already have | a-desktop | yes | {"ok":true,"up":{"clicked":true,"dialog":true,"multiple":false}} | The uploaded file is a synthetic, fictional comic cover. |
| 2.18 | The form remembers your last category | a-desktop | yes | ["Pop Culture","Comics"] |  |
| 2.19 | A gift: type 0, not nothing | a-desktop | yes | 0 |  |
| 2.20 | Zero stays zero, blank stays unknown | a-desktop | yes | {"ok":true,"giftPrice":0,"giftValue":null,"giftTax":null} |  |
| 2.21 | The Add Item form on a phone | a-phone | yes | {"ok":true} |  |
| 2.22 | Take a photo | a-phone | yes | true | The viewfinder shows a test camera playing a synthetic, fictional picture. On a real phone the browser asks to allow the camera first; that prompt cannot be captured. |
| 2.23 | Keep or retake | a-phone | yes | true | Test camera picture. |
| 2.24 | Type the name | a-phone | yes | Retro Robots Series 2 Action Figure (boxed) |  |
| 2.25 | Purchase price and current value | a-phone | yes | ["38.00",""] |  |
| 2.26 | Saved | a-phone | yes | {"ok":true,"path":"/vault"} |  |

**Result: 52 of 52 demonstrated steps verified.**
