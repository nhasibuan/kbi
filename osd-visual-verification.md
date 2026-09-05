# OSD visual verification

The public `/osd` route was checked at 1280×720 and 1024×768. The screen presents the large active queue panel on the right, waiting and in-treatment panels below it, an education video panel on the left, a clinic information card, and a full-width running announcement at the bottom. The empty state is legible when no active records exist. The layout remains readable at the narrower wide-screen size, with no horizontal page overflow observed.

The OSD query refreshes every five seconds and exposes only queue number, patient name, selected poli, assigned service time, doctor label, and status; it does not expose WhatsApp numbers or free-text notes.
