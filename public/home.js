// Preserve deep bookmarks. A plain visit always opens the chooser.
if (/^#(?:route|itinerary|packing|notes|guides|day-|event-)/.test(location.hash)) {
  location.replace(new URL('./trip.html' + location.hash, location.href));
}
