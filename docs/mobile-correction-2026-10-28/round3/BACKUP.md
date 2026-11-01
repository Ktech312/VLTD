# Backup of the seven video commits (2026-10-31)

## What is protected, and where
- Commits `da1f553`, `5380e46`, `6d80044`, `f7a07fb`, `79b64f5`, `b3e28fc`, `747f8c4` (branch `universes-removal`, 7 ahead of `origin/main`, nothing else on that branch).
- Local backup branch in the same repository: `backup/add-item-guide-videos-2026-10-31` -> `747f8c4`.
- Git bundle outside the repository: `C:\Users\EK\VLTD-backups\add-item-guide-videos-2026-10-31.bundle`, 375.1 MB, SHA-256 `0172C6792EF8079A89EC45C0C1E5C67B9F6867DE6EF9581AD12E156C7864FDEF`, `git bundle verify` = okay. Restore with `git clone <bundle>` or `git fetch <bundle> backup/add-item-guide-videos-2026-10-31:restored-videos`.
- The worktree `quizzical-hamilton-a45b28` and its working files were not touched; the tree is clean.

## Size check (done before anything else)
636 objects in the seven commits, 486.6 MB uncompressed (video does not compress), 234 of them video/audio blobs (older renders of the same files). Largest single file 33.4 MB; none over 50 MB (GitHub warns) or 100 MB (GitHub refuses). A push would be about 375 MB, fine for GitHub's size guidance. Vercel configuration: only cron jobs in `vercel.json`; a branch push would also create a Vercel preview deployment of that old branch (the docs folder is not served).

## Why the remote copy was not made
`https://api.github.com/repos/Ktech312/VLTD` reports `"private": false`: **the repository is public**. A remote backup branch there would make all videos (and the narration audio and screenshots) downloadable by anyone, which is publishing them. Not done.

## To finish (needs a private remote, which only you can provide)
```bash
git remote add private-backup <URL of a private repository>
git push private-backup universes-removal:refs/heads/backup/add-item-guide-videos-2026-10-31
```
(from the video worktree). A private repository on GitHub allows the same file sizes.

## Also worth knowing
The documentation I pushed to `main` during this work (screenshots of synthetic test accounts, measurement reports, scripts) is therefore also public. It contains no passwords or keys (account manifests with credentials are untracked), but screenshots show synthetic test-account emails.
