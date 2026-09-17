# Astrovisibility

## Releases

- [Astrovisibility v0.0.1](https://github.com/cosmicPickle/astrovisibility/releases/tag/v0.0.1) — Android APK

Astrovisibility is an Android astronomy planner that shows when a target is actually visible from one exact observing position through buildings, roofs, trees, window frames, and other local obstructions. Profiles, panoramas, masks, and equipment stay on your phone; the sky catalogue works offline.

## Install on Android

Open the latest release above, download its `.apk` asset, and open the downloaded file. If Android blocks the installation, open the displayed settings screen and allow **Install unknown apps** for the browser or file manager that opened the APK, then retry. The setting name and location vary by phone; you can disable that permission again after installation.

## Quick start

1. Optionally add your telescope and camera under **Equipment** so the app can show the field of view and filter suitable targets.
2. Create a **Profile** for the exact place where you observe, such as a balcony corner or garden telescope position.
3. Open the profile's **Sky View**, pan or zoom around the sky, and tap an object to inspect its trajectory and details.
4. From the profile menu, capture or import your surroundings, then paint local obstacles in the **Mask Editor**.
5. Open **View All Targets** to compare objects by usable observing time, then tap one to return to it in the sky.

## App sections

- **Profiles:** Each profile represents one fixed observing position and location. Create separate profiles when nearby obstacles line up differently. A profile without a mask still supports sky browsing, but local obstruction visibility is not yet known.
- **Equipment:** Add, edit, or delete a telescope/camera setup using its optical and sensor measurements. Select a setup in Sky View to display its imaging frame and filter the target list for objects that fit it.
- **Sky View:** Pan, zoom, change the observing window, choose equipment, and open **View options** to adjust target density, filters, constellation opacity, and mask appearance. The mask can use a color or show the panorama only over blocked areas. Tap a target to see its path, visible/blocked portions, transition times, visible duration, approximate size, and more information.
- **View All Targets:** Search and filter the catalogue. Tap the funnel beside search to show minor-axis size limits in sensor pixels (with selected optics) and minimum usable visibility in minutes. These filters are shared with Sky View options; size limits retain the global 60 px minimum. Choose **Longest Visible** or **Biggest** ordering in the target list. Targets with no usable visibility through local obstructions appear last in either order. Targets show every visible interval, and selecting one returns to the positioned target in Sky View.
- **Panorama and Mask:** Capture or import a partial or wide view from the observing position, align it with the sky, then paint obstacles such as roofs, trees, and window frames. Painted obstacles and uncaptured directions are blocked. The mask can be edited later; replacing the panorama recreates the panorama/mask pair.
- **About and licences:** Review catalogue and open-source attribution, or permanently delete all locally stored profiles, equipment, panoramas, and masks.

No account or cloud upload is required. Camera, foreground location, and motion access are requested only for assisted panorama capture; image import and manual alignment remain available when those permissions are unavailable.
