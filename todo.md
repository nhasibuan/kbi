# Logo replacement tasks

- [x] Copy the user-provided Klinik Berkat Insani logo into the managed static-asset workspace and upload it for web delivery.
- [x] Replace the existing PrimeCare logo URL in shared page references and update the page metadata.
- [x] Check desktop and mobile logo placement, then save and publish the revision.

## Visual editor verification

- [x] Merge the duplicate header style attributes into one valid JSX declaration while retaining the intended 200px square logo size.
- [x] Confirm the 100px footer logo size and verify the desktop layout, then save a refreshed checkpoint.

## Klinik Berkat Insani content update

- [x] Review the public Instagram profile and capture services, location, contacts, and stated positioning relevant to the website.
- [x] Cross-check material facts against independent public sources and identify claims that should not be presented as confirmed.
- [x] Replace the concept content with original paraphrases grounded in the verified source record.
- [x] Validate the revised site and publish an updated checkpoint.

## Supplied clinic-content review

- [x] Separate confirmed clinician, clinic, schedule, and service details from marketing proposals, unsupported market claims, and testimonial suggestions.
- [x] Cross-check the supplied schedules, contact number, address, and clinician information against publicly available sources.
- [x] Add only verified clinic details to the website in paraphrased Indonesian copy, without fabricating testimonials or outcomes.
- [x] Validate the revised layout and publish the reviewed update.

## Service-card image normalization

- [x] Inspect the current care-card image wrapper and identify why visual heights appear inconsistent.
- [x] Apply one explicit responsive height and `object-cover` crop treatment to all service-card images.
- [x] Verify desktop and mobile card image consistency, then publish the correction.

## Alur Kunjungan divider alignment

- [x] Locate the existing Alur Kunjungan rule and confirm its relationship to the section paragraph.
- [x] Move the rule beneath the paragraph and center it within the section.
- [x] Validate the desktop and mobile placement, then publish the alignment correction.

## Full-stack persistence and file storage

- [x] Define a minimum persistent data model for clinic content, service details, location information, and managed media assets.
- [x] Upgrade the project to the full-stack database and file-storage capability.
- [x] Build an authenticated administrative foundation for managing persisted clinic content and stored assets.
- [x] Verify database persistence, file storage, and public-site compatibility before publishing.
- [x] Upload a verification image through the managed storage helper, persist its metadata, and confirm its stored URL resolves.
- [x] Confirm the stored asset is visible in the CMS after refresh and include the evidence in final validation.

## Persistent appointment requests

- [x] Define a data-minimized appointment-request model with consent, retention, and non-emergency guardrails.
- [x] Create the appointment-request database table and protected backend procedures for staff review.
- [x] Add a public appointment-request form and an administrator-only request queue in the clinic CMS.
- [x] Validate public submission, database persistence, staff-only access, and responsive form usability before publishing.

## WhatsApp appointment follow-up

- [x] Define a data-minimized staff message that includes only name, service, and preferred date while excluding free-text notes.
- [x] Add an administrator-only WhatsApp follow-up action to appointment requests with manual message review before sending.
- [x] Validate generated WhatsApp links, status updates, and CMS responsiveness before publishing.

## WhatsApp staff signature template

- [x] Define a reusable clinic signature template with an approved default and clear privacy boundaries.
- [x] Persist the signature template and make it editable only by authenticated administrators.
- [x] Append the saved signature to editable WhatsApp follow-up drafts without including request notes.
- [x] Validate template persistence, draft composition, and responsive CMS controls before publishing.

## WhatsApp draft length and preview

- [x] Define a clear recommended character length and user-facing guidance for staff follow-up drafts.
- [x] Add a live character counter, length status, and formatted preview to the protected WhatsApp dialog.
- [x] Validate counter accuracy and preview usability across desktop and mobile before publishing.

## WhatsApp follow-up activity history

- [x] Define activity records that store only appointment reference, final draft length, workflow status, staff actor, and timestamp.
- [x] Create the activity-history table and administrator-only record/list procedures without storing draft text or patient notes.
- [x] Record the final draft metrics from the WhatsApp dialog and display operational history in the protected CMS.
- [x] Validate activity persistence, staff-only access, and responsive history presentation before publishing.
- [x] Create and clean up a temporary QA request while verifying recorded activity rows persist without message content or notes.
- [x] Capture the populated activity history on desktop and mobile, verifying status labels, final character counts, and timestamps.
- [x] Re-run protected-access and final production validation after end-to-end activity verification.
- [x] Capture authenticated desktop and mobile views of populated activity cards, then verify the final labels, counts, and timestamps before publishing.
- [x] Restart the CMS preview and capture settled authenticated populated-history views without relying on stale missing-session log entries.

## WhatsApp activity-history filters

- [x] Define administrator-only date-range and activity-status filter inputs, including an unfiltered default and clear empty state.
- [x] Extend the protected activity-history query to apply validated date and status filters.
- [x] Add responsive filter controls, filtered summary metrics, and reset behavior to the CMS activity history.
- [x] Validate filter accuracy, protected access, empty results, and desktop/mobile layout before publishing.
- [x] Capture authenticated desktop and mobile activity-history filters with populated results and verify the status/date controls render for staff.
- [x] Apply a no-match filter in the authenticated CMS and verify the filtered empty-state message before final release.
- [x] Inspect the authenticated desktop and mobile populated-filter captures to confirm the staff-facing controls and filtered cards are visibly rendered.
- [x] Inspect the authenticated no-match capture and confirm its protected filtered query returned zero activity rows.

## Appointment emergency-guidance wording

- [x] Verify the revised non-emergency guidance exactly matches the requested wording change.
- [x] Validate the revised public appointment form on desktop and mobile, then run production checks.
- [x] Capture and review the mobile appointment-request dialog with the revised emergency guidance before publishing.
- [x] Inspect the captured mobile dialog and record confirmation that the revised emergency guidance is visible and legible.
- [x] Save and publish the verified wording update.

## Administrator access verification

- [x] Verify berkatinsani2000@gmail.com authenticates as an administrator on the protected Klinik CMS.
- [x] Test editing a temporary clinic profile value and confirm the protected admin procedure persists it.
- [x] Test managed-file upload and listing with a temporary QA asset, then remove the asset and restore the profile.
- [x] Confirm non-admin access remains denied and all temporary QA data is cleaned up before reporting results.
- [x] Record the final administrator verification result for the user.

## Latest CMS dashboard and login check

- [x] Confirm the production `/admin` route loads its protected dashboard entry state correctly.
- [x] Verify the sign-in flow and current administrator authorization state for berkatinsani2000@gmail.com.
- [x] Report the dashboard and login verification result.
- [x] Complete a real authenticated browser login for berkatinsani2000@gmail.com and confirm the CMS dashboard renders.
- [x] Run a protected CMS query or action within that authenticated browser session and record the result.
- [x] Deliver the final dashboard and login verification summary after the authenticated browser check.

## Public appointment rate limiting

- [x] Define the IP-keyed submission window, threshold, trusted-proxy behavior, and retry response without collecting additional patient data.
- [x] Implement server-side appointment rate-limit logic while preserving the existing honeypot behavior.
- [x] Add unit tests that allow normal submissions and reject rapid repeated requests from the same IP.
- [x] Validate tests, types, production build, and protected endpoint behavior before publishing.
- [x] Prune expired client entries from the in-memory rate-limit store to bound memory use under high-cardinality traffic.
- [x] Add router-level appointment-create tests covering normal requests, rapid same-IP rejection, and honeypot short-circuit behavior.
- [x] Re-run full validation after bounded-memory and endpoint-level rate-limit coverage is complete.

## Appointment CAPTCHA fallback

- [x] Define the rate-limit-to-CAPTCHA fallback state, provider contract, privacy boundaries, and accessible recovery path.
- [x] Configure verified CAPTCHA site and secret credentials through managed project secrets.
- [x] Verify CAPTCHA tokens server-side and allow a solved challenge to proceed without weakening honeypot protection.
- [x] Add a responsive CAPTCHA fallback panel to the public appointment dialog only after a rate-limit response.
- [x] Test normal, rate-limited, invalid-token, solved-token, and honeypot submission paths before publishing.
- [x] Trigger the public appointment rate limit and capture the conditional CAPTCHA fallback panel on desktop and mobile.
- [x] Exercise the triggered CAPTCHA path with real Turnstile test credentials, covering invalid, solved, and honeypot paths without retaining QA appointments.
- [x] Trigger the rate-limit state from the real public endpoint and connect it to the conditional fallback view on desktop and mobile.
- [x] Verify an official Turnstile dummy token is accepted through the real rate-limited appointment endpoint in development, then remove all QA appointments.

## Appointment-dialog wording update

- [x] Verify the updated public appointment-dialog description matches the user's approved wording.
- [x] Run regression checks and publish the verified wording revision.

## Appointment consent wording update

- [x] Verify the updated public appointment consent statement matches the user's approved wording.
- [x] Run regression checks and publish the verified consent revision.

## Instagram post embeds

- [x] Replace the target Home-page content block with the three supplied Instagram post embeds.
- [x] Verify responsive rendering and Instagram script hydration, or document third-party preview limitations; production build is verified.
- [x] Save and publish the verified Instagram embed revision.

## Instagram embed QA notes

- [x] Confirm the three supplied Instagram permalinks are present as external embed markup without fabricating post content.

- [x] Inspect desktop and mobile captures: the three Instagram embed containers stack responsively, and each post exposes a visible direct Instagram link when the external embed script does not hydrate in the preview capture.

## Home-page Instagram fallback link removal

- [x] Identify the exact Instagram fallback link intended for removal from the Home page.
- [x] Remove only the requested link and verify the affected desktop/mobile layout.
- [x] Run regression checks and publish the verified link-removal revision.

- [x] Inspect desktop and mobile captures after removal: the Home-page header and hero remain intact and responsive, with no layout break caused by deleting the direct Instagram fallback anchor.

- [x] Confirm post-removal DOM state in the live preview: three Instagram iframes remain hydrated, zero “Buka postingan di Instagram” fallback anchors remain, and the desktop grid resolves to three equal columns.

## No-change verification request

- [x] Confirm the current working tree has no unreviewed visual-edit changes and the existing Home-page Instagram revision remains intact.
- [x] Run regression checks and publish the verified current revision as a new checkpoint.

## Instagram captioned-attribute removal

- [x] Remove `data-instgrm-captioned` from the three Instagram embed blocks.
- [x] Verify the three embeds still hydrate and the responsive layout remains intact.
- [x] Run regression checks and publish the verified attribute-removal revision.

- [x] Confirm live preview DOM after removal: three Instagram iframes hydrate successfully and zero `data-instgrm-captioned` attributes remain.

## Home-page button removal

- [x] Identify the exact button intended for removal at the reported Home-page location.
- [x] Remove only the requested button and verify the affected desktop/mobile layout.
- [x] Run regression checks and publish the verified button-removal revision.

- [x] Confirm live DOM after removal: zero buttons contain “Tanya informasi”, three Instagram iframes remain hydrated, and the desktop journal grid still uses three equal columns.

- [x] Inspect the full-page mobile capture after removal: the Informasi layanan heading flows without the deleted button and the three Instagram cards remain stacked and reachable.

## Home-page container removal

- [x] Identify the exact div intended for removal at the reported Home-page location.
- [x] Remove only the requested div and verify the affected desktop/mobile layout.
- [x] Run regression checks and publish the verified container-removal revision.

- [x] Inspect desktop and mobile hero captures: the decorative care-mark container is absent, while the hero image, overlay, navigation, headline, and booking controls remain clean and responsive.

- [x] Confirm live hero DOM after removal: zero care-mark images remain, the original hero headline is present, seven booking buttons remain across the page, and all seven main sections are intact.

- [x] Confirm a 375px headless-browser render after removal: the care-mark asset is absent, the original hero headline and booking controls remain in the rendered DOM, and the Instagram embeds hydrate with the mobile one-column layout.

## Home-page service label update

- [x] Identify the exact “Poli Kandungan” label targeted at the reported Home-page location.
- [x] Replace the targeted label with “Tenaga Profesional” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified label revision.

- [x] Inspect desktop and mobile captures: the hero service-card strip remains aligned and the Tenaga Profesional label fits cleanly within the responsive presentation.

- [x] Confirm live DOM: exactly one Tenaga Profesional label is rendered, the old hero Poli Kandungan label is absent, and the supporting examination description remains present.

- [x] Confirm 375px mobile DOM: Tenaga Profesional renders in the service strip, and the responsive `sm:grid-cols-2 lg:grid-cols-4` class remains intact for mobile stacking and larger breakpoints.

## Home-page service label update: Layanan Kesehatan

- [x] Identify the exact “Poli Umum & Gigi” label targeted at the reported Home-page location.
- [x] Replace the targeted label with “Layanan Kesehatan” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified label revision.

- [x] Confirm live DOM: exactly one Layanan Kesehatan label and one Tenaga Profesional label render, while the old Poli Umum & Gigi label is absent.

- [x] Confirm 375px mobile DOM: Layanan Kesehatan renders once, and the service strip retains its `sm:grid-cols-2 lg:grid-cols-4` responsive class.

## Home-page service description update

- [x] Identify the exact service description targeted at the reported Home-page location.
- [x] Replace it with the supplied facilities wording and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified description revision.

- [x] Inspect desktop and mobile captures: the updated facilities description remains contained in the service-card strip, with no visible clipping or layout break in the reviewed captures.

## Home-page service option update: Optik

- [x] Identify the exact “Daftar via WhatsApp” option targeted at the reported Home-page location.
- [x] Replace the targeted option label with “Optik” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified option-label revision.

- [x] Confirm live DOM: exactly one Optik service-tab button renders, zero Daftar via WhatsApp tab buttons remain, and the separate Daftar via WhatsApp care card is preserved.

- [x] Confirm 375px mobile DOM: the service-tab button at Home.tsx:304 is Optik, the old tab label is absent, and the separate Daftar via WhatsApp card remains at Home.tsx:340.

## Home-page service option update: Laboratorium

- [x] Identify the exact “Poli Umum” option targeted at the reported Home-page location.
- [x] Replace the targeted option label with “Laboratorium” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified option-label revision.

- [x] Confirm live DOM: Laboratorium, Poli Kandungan, Poli Gigi, and Optik each render exactly once as service-tab buttons.

## Home-page service option update: Radiology

- [x] Identify the exact “Poli Kandungan” option targeted at the reported Home-page location.
- [x] Replace the targeted option label with “Radiology” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified option-label revision.

- [x] Confirm live DOM: Laboratorium, Radiology, Poli Gigi, and Optik each render exactly once as service-tab buttons, with the old Poli Kandungan tab label absent.

## Home-page service option update: Rehabilitasi Medik

- [x] Identify the exact “Poli Gigi” option targeted at the reported Home-page location.
- [x] Replace the targeted option label with “Rehabilitasi Medik” and verify the affected desktop/mobile section.
- [x] Run regression checks and publish the verified option-label revision.

- [x] Confirm live DOM: Laboratorium, Radiology, Rehabilitasi Medik, and Optik each render exactly once as service-tab buttons, while the old Poli Gigi tab label is absent.

## Home-page link-anchor removal

- [x] Identify the exact anchor targeted at the reported Home-page location.
- [x] Remove only the requested link anchor and verify the affected desktop/mobile layout.
- [x] Run regression checks and publish the verified link-removal revision.

- [x] Confirm live DOM: zero “Lihat alur kunjungan” anchors remain and seven Ajukan kunjungan buttons are still present across the page.

## Repository recovery completion

- [x] Mirror the non-empty `nhasibuan/primecare-clinic-reimagined` repository into `nhasibuan/kbi`.
- [x] Reconnect `/home/ubuntu/primecare-clinic-reimagined` to the `user_github` remote at `https://github.com/nhasibuan/kbi.git`.
- [x] Preserve the former partial workspace in `/home/ubuntu/primecare-clinic-reimagined.partial-recovery-20260901-225400`.
- [x] Install dependencies and verify the restored development server.

## Development server recovery

- [x] Restart the development server after it stopped responding.
- [x] Verify the server health and preview availability.

## Automatic queue numbering and preferred appointment time

- [x] Inspect the restored appointment schema, router, public form, confirmation UI, and admin queue workflow.
- [x] Add persisted preferred-time, assigned-time, and daily queue-number fields without storing medical data.
- [x] Implement validated `XX:YY AM|PM` parsing and collision allocation with 30-minute delays.
- [x] Update the public form and confirmation UI with `Jam pilihan`, `Nomor antrian`, and `Jam layanan` in Bahasa Indonesia.
- [x] Update the protected admin queue display with assigned queue and service times.
- [x] Add unit coverage for parsing, daily numbering, collisions, and normal appointment behavior.
- [x] Run tests, type checks, production build, and responsive verification.

## Appointment form refinement

- [x] Display the assigned `Nomor antrian` before `Nama lengkap` in the appointment form flow.
- [x] Validate the hour and minute text input strictly as `XX:YY`.
- [x] Move `AM|PM` into a separate select control and combine it safely for backend submission.
- [x] Update tests, responsive verification, and save the refined checkpoint.
