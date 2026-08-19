# Astro Visibility - Mobile App Specification

**Document:** `astro-visibility-spec.md`\
**Status:** Initial v1 specification\
**Scope:** Product behavior and user-facing requirements only.
Implementation technologies are intentionally out of scope.

## 1. Purpose

Astro Visibility is a mobile astronomy planning application for
observers whose usable sky is constrained by local obstructions such as
buildings, window frames, balconies, terraces, roofs, trees, branches,
poles, and similar objects.

The application answers a more specific question than a conventional
astronomical horizon planner:

> From this exact observing position, when is a target actually visible
> through my real surroundings?

A conventional horizon profile is insufficient because an obstruction is
not necessarily continuous from the horizon upward. A nearby tree
branch, balcony, or window frame can block an isolated region of sky
while areas both above and below it remain visible.

Astro Visibility therefore models an observing profile as a
**two-dimensional visibility mask over the sky**, rather than as a
one-dimensional horizon line.

## 2. Core Concepts

### 2.1 Profile

A **Profile** represents one fixed observing position.

Examples:

-   Bedroom window
-   Backyard telescope position
-   Balcony corner
-   Countryside house terrace

A profile contains:

-   A name.
-   The observing location required for astronomical positioning.
-   An optional captured panorama.
-   An optional editable visibility mask associated with that panorama.

Profiles are independent. Moving the telescope enough to materially
change how nearby obstacles line up with the sky should be represented
by a separate profile.

### 2.2 Visibility Mask

The visibility mask describes which directions from the observing
position are usable.

The mask supports arbitrary two-dimensional obstruction geometry. This
allows it to represent, for example:

-   A tree trunk.
-   Individual branches.
-   A roof.
-   A window frame.
-   An overhanging terrace.
-   A balcony above the telescope.
-   Gaps between obstacles.
-   Multiple separate blocked regions at the same azimuth but different
    altitudes.

The mask is **not required to cover the entire sky**.

A user may capture anything from a single limited view to a full
360-degree environment, including upward-looking regions.

There is no "unknown" visibility state. **Any direction outside the
defined visible area of the mask is considered blocked by default.**

Therefore the visibility model is binary:

-   **Visible**
-   **Blocked**

### 2.3 Panorama

A panorama is the visual representation captured from the observing
position and used to create the mask.

"Panorama" does not imply that a full 360-degree panorama is required. A
profile may contain only a partial capture.

The capture process must support:

-   Narrow captures.
-   Wide captures.
-   Up to full 360-degree horizontal coverage.
-   Vertical coverage extending upward as necessary, including toward
    the zenith.

The captured region must retain sufficient directional information for
the application to know which portion of the sky it represents.

### 2.4 Telescope / Camera Configuration

A **Telescope Configuration** describes an imaging setup and the
information necessary to determine its field of view and target
suitability.

For v1, configurations are custom and entered manually by the user.

Each configuration has:

-   Name.
-   Telescope focal length.
-   Telescope aperture / diameter.
-   Camera sensor dimensions or equivalent information required to
    determine field of view.
-   Sensor pixel size.
-   Any other manually entered optical/camera parameters necessary to
    derive the imaging field of view.

The exact set of fields may be refined during detailed product design,
but v1 does not require a database of commercial telescope or camera
models.

### 2.5 Target

A target is an astronomical object that can be displayed and evaluated
from a profile.

For v1, the primary focus is deep-sky objects (DSOs).

The initial target catalogue should include at minimum:

- Messier objects.
- NGC objects.
- IC objects.
- Caldwell objects.

Target data must include, where available:

-   Human-readable/common name.
-   Catalogue identifiers.
-   Sky coordinates.
-   Angular dimensions.
-   Other information required for target suitability and sky-view
    display.

When a well-known human-readable name exists, it must be presented
prominently.

For example:

**Andromeda Galaxy**\
M31 / NGC 224

should not be presented merely as:

**M31**

## 3. Dashboard

The Dashboard is the application's primary entry point.

It contains two major areas:

1.  Observing Profiles
2.  Telescope / Camera Configurations

### 3.1 Observing Profiles

The Dashboard lists all locally saved profiles.

Each profile entry should clearly display its name and provide access to
the profile.

The Dashboard provides an action to create a new profile.

Selecting a profile opens its **Sky View**.

### 3.2 Telescope / Camera Configurations

The Dashboard also lists the user's saved telescope/camera
configurations.

The user can:

-   Create a configuration.
-   Name it.
-   Enter its optical and camera parameters manually.
-   Edit it.
-   Delete it.

All profile and telescope configuration information is stored locally
for v1 in a logical persistent format.

No account, synchronization, or remote storage behavior is required by
this specification.

## 4. Profile Sky View

Selecting a profile opens a full-screen interactive view of the sky from
that observing position.

The view must be:

-   Scrollable / pannable.
-   Zoomable.
-   Able to represent the full relevant sky, including the zenith.

The view behaves broadly like a planetarium sky map for navigation and
target selection.

It is the central screen of the application.

## 5. Sky Objects

Deep-sky targets are rendered at their correct sky coordinates.

Full photographic or artistic visualization of DSOs is not required for
v1.

Each displayed target must show:

-   Its name.
-   An outline representing its approximate angular size and shape.

Depending on the target, the outline may be circular or elliptical.

### 5.1 Zoom-Based Target Visibility

The application must avoid cluttering the sky view with every known
target simultaneously.

As in planetarium applications such as Stellarium, the set of displayed
targets depends on the current zoom level.

At wide zoom levels, only sufficiently prominent/relevant targets are
shown.

As the user zooms in, additional targets become visible.

The exact filtering rules are a product-design detail, but target
density must remain usable at every zoom level.

### 5.2 Selecting a Target

A displayed target can be tapped.

Selecting it:

-   Marks it as the currently selected target.
-   Displays its visibility arc for the relevant observing period.
-   Displays relevant target information and visibility information
    without unnecessarily obscuring the sky view.

Only one primary target needs to be selected at a time in v1.

### 5.3 Target Information

When a target is selected, the Sky View provides a compact **More Info** affordance, such as an information/question-mark button.

Selecting it opens a popup or modal containing the available information about the target.

The target information UI should not permanently occupy significant Sky View space.

## 6. Target Visibility Arc

The visibility arc represents the selected target's path across the sky
over time.

It is evaluated against the profile's two-dimensional visibility mask.

The arc visually distinguishes between:

-   **Visible portions**
-   **Blocked portions**

Visible portions should use a clear continuous representation.

Blocked portions should use a visually distinct representation, such as
a faded or dashed arc.

### 6.1 Visibility Transitions

Whenever the target changes between visible and blocked, the arc should
identify the transition and its time.

Examples:

-   **Visible until 01:10**
-   **Visible after 02:10**

There may be any number of transitions during a night.

In addition to transition labels, the arc should display regular time markers at **30-minute intervals** so the user can visually relate every part of the trajectory to time.

For example, a branch may result in:

-   Visible from 22:00 to 01:10.
-   Blocked from 01:10 to 02:10.
-   Visible again after 02:10.

The system must not assume that visibility becomes permanent once a
target rises above an obstruction.

### 6.2 Fine Obstructions

Visibility calculations must conceptually support relatively small
obstruction regions such as individual nearby branches.

The product should therefore not simplify a profile into a single
obstruction altitude for each azimuth.

### 6.3 Mask Boundary Behavior

Any portion of a target trajectory that falls outside the profile's
defined visible mask is treated as **blocked**.

No "unknown" trajectory state is shown.

## 7. Profile Overlays

The Sky View supports toggleable overlays.

### 7.1 Profile Mask Overlay

Shows the profile's visible and blocked regions.

The user can:

-   Toggle the mask on/off.
-   Adjust its opacity.

### 7.2 Panorama Overlay

Shows the captured panorama aligned with the sky.

The user can:

-   Toggle the panorama on/off.
-   Adjust its opacity.

### 7.3 Combined View

The panorama and mask can be enabled simultaneously.

Each retains independent visibility/opacity control.

This allows the user to inspect the actual surroundings, the interpreted
mask, or both while comparing them with astronomical targets and
visibility arcs.

## 8. Telescope Selection and Field of View

The Profile Sky View includes a telescope/camera configuration selector.

If configurations exist:

-   The first configuration is selected by default.
-   The user can select another saved configuration.
-   The selected configuration's imaging frame / field of view is
    displayed on the sky.

This allows the user to see how the selected target fits within the
imaging setup.

### 8.1 Field-of-View-Aware Visibility

Ideally, target visibility calculations account for the entire imaging
frame rather than only the target's central coordinate.

For example, a target center may be unobstructed while part of the
camera frame intersects a roof or branch.

This behavior is desirable but **not mandatory for v1** if it introduces
disproportionate complexity.

A center-point visibility calculation is acceptable for the initial
version.

### 8.2 No Telescope Configuration

A profile does not require a telescope configuration.

If none exists or none can be applied:

-   The Sky View remains usable.
-   Target visibility is calculated without scope-specific field-of-view
    constraints.
-   **View All Targets** lists all otherwise eligible targets rather
    than filtering them by scope suitability.

## 9. View All Targets

The Profile Sky View contains a prominent **View All Targets** action.

This may, for example, be positioned at the bottom-right of the Sky
View.

Selecting it opens a child page associated with the current profile.

The child page has a header with a Back action returning to the Profile
Sky View.

## 10. Target List

The Target List displays targets ranked primarily by how long they are
visible from the selected profile during the relevant observing period.

Targets with more usable visibility appear before targets with less.

### 10.1 Scope Suitability

When a telescope/camera configuration is selected, only targets
considered suitable for that configuration are included.

Suitability should consider the relationship between the target's
angular dimensions and the selected imaging field of view.

The purpose is to avoid recommending targets that are clearly
inappropriate for the selected setup.

If no telescope configuration exists, this filter is omitted and all
targets are considered.

### 10.2 Target Row

Each target row displays at minimum:

-   Human-readable target name, where available.
-   Catalogue identifier(s) as secondary information.
-   Total visible duration.
-   Visibility interval(s).

For example:

**Andromeda Galaxy**\
*M31 / NGC 224*\
**Total visible: 5h 48m**\
22:14-01:10 · 02:10-05:12

A target with several obstruction crossings may have several visibility
intervals.

### 10.3 Selecting from the Target List

Tapping a target row:

1.  Returns the user to the Profile Sky View.
2.  Selects that target.
3.  Positions the view appropriately so that the selected target and its
    visibility arc can be inspected.

## 11. Panorama and Mask Creation

A profile may initially have no panorama or mask.

In that state, the Profile Sky View provides an action to create one.

To avoid cluttering the primary Sky View, panorama/mask management
actions should normally live inside the profile menu rather than each
receiving permanent buttons.

### 11.1 Creation Flow

Creation consists of two explicit stages:

1.  **Capture Panorama**
2.  **Draw Visibility Mask**

The user progresses through these stages in order.

### 11.2 Stage 1 - Capture Panorama

The user captures the surroundings from the profile's observing
position.

Requirements:

-   A full 360-degree capture is not required.
-   A single limited capture is valid.
-   The user can capture a wider horizontal region if desired.
-   The capture process supports looking upward.
-   The captured imagery retains its correspondence with directions in
    the sky.
-   The final capture defines the region within which the user can draw
    visible sky.

The capture should be performed from as close as reasonably practical to
the telescope/camera's actual observing position.

### 11.3 Stage 2 - Draw Visibility Mask

After capture, the user is presented with the panorama and creates the
visibility mask.

The user marks the portions of the captured sky that should be
considered visible.

Everything else is blocked.

This includes:

-   Explicitly obstructed portions inside the capture.
-   Areas outside the captured coverage.

The mask editing experience should allow sufficient precision to
represent irregular boundaries and relatively narrow obstacles such as
branches.

After completion, the panorama and mask are saved to the profile.

## 12. Editing and Replacing Profile Imagery

For v1, a panorama cannot be replaced directly while retaining the
existing mask.

Instead, the user can:

-   Delete the existing panorama/mask.
-   Perform the panorama/mask creation flow again.

This prevents ambiguous alignment between a new panorama and a mask
created against an old panorama.

### 12.1 Mask Editing

The mask itself **can be edited** without recapturing the panorama.

This allows users to:

-   Correct mistakes.
-   Refine branches or edges.
-   Change which regions are considered usable.

## 13. Profile Menu

The Profile Sky View should remain visually focused on the sky.

Persistent primary controls should be limited.

At minimum, immediately accessible controls should include:

-   Visibility/profile overlay controls.
-   **View All Targets**.

Less frequently used profile operations should be grouped into a menu
accessible from the upper-right area of the screen, such as a hamburger
or overflow menu.

Possible menu items include:

-   Add panorama/mask, when missing.
-   Edit mask.
-   Delete panorama/mask.
-   Recreate panorama/mask.
-   Edit profile.
-   Other profile-management actions introduced later.

Exact menu organization is a UI design decision, but avoiding control
clutter on the Sky View is a requirement.

## 14. Visibility Calculation Behavior

For a selected target and observing period, the application determines
the target's path through the profile's sky.

At each point along that path, the target is classified as either:

-   Visible.
-   Blocked.

The classification is determined by the profile mask.

The application then derives contiguous visibility intervals and
obstruction intervals.

Transition times are exposed to the UI so they can be displayed both:

-   On the visibility arc.
-   In the Target List.

The application must support multiple visibility intervals for the same
target during one observing period.

## 15. Behavior When a Profile Has No Mask

A newly created profile may not yet have a panorama/mask.

The profile must still be usable.

In this state:

-   The normal sky map can be viewed.
-   Targets can be browsed and selected.
-   Astronomical target trajectories can be shown.
-   The UI should make it clear that local obstruction visibility has
    not yet been defined.
-   The user is offered the panorama/mask creation action.

Because no local visibility mask exists yet, obstruction-derived
"visible until/after" results must not be presented as if they were
known.

This is distinct from a completed partial mask: once a mask exists,
directions outside its defined visible area are blocked by default.

## 16. Local Data

For v1, user-created information is local.

This includes:

-   Profiles.
-   Profile metadata.
-   Panorama data.
-   Visibility masks.
-   Telescope/camera configurations.
-   User edits.

The data should be organized in a logical persistent format so that
profiles and their associated information remain coherent.

Remote accounts, synchronization, sharing, and server-side storage are
outside the scope of v1.

## 17. V1 Functional Summary

A successful v1 allows a user to:

1.  Create an observing profile.
2.  Open an interactive sky view for that profile.
3.  Capture a partial or complete view of their surroundings.
4.  Draw a detailed two-dimensional visible-sky mask.
5.  Edit that mask later.
6.  Browse DSOs at their correct positions.
7.  See approximate target angular dimensions.
8.  Select a target.
9.  See its trajectory across the sky.
10. Immediately distinguish visible and blocked portions of that
    trajectory.
11. See labels such as **Visible until 01:10** and **Visible after
    02:10** at obstruction crossings.
12. Create custom telescope/camera configurations.
13. Visualize the selected configuration's field of view.
14. Browse targets ranked by usable visibility.
15. Filter that target list for targets suitable for the selected
    imaging configuration.
16. Select a target from the list and return directly to its trajectory
    in the Sky View.

## 18. Explicitly Outside V1 Scope

Unless separately specified, v1 does not require:

-   User accounts.
-   Cloud synchronization.
-   Remote storage.
-   Social/community features.
-   Commercial telescope/camera model databases.
-   Telescope control.
-   Direct integration with Dwarf or other telescope hardware.
-   Photorealistic DSO rendering.
-   Automatic replacement/re-alignment of an existing panorama.
-   Full-frame obstruction calculations if center-point visibility is
    used instead.
-   A full 360-degree capture.
-   Any particular implementation technology or architecture.

## 19. Open Product Questions

The following details remain intentionally open for later specification:

- Exact interaction and visual design of the date/time selector.
- Exact target information fields shown in the More Info popup.
- Exact styling of visible versus blocked trajectory segments.
- Exact placement and collision-avoidance behavior of 30-minute time labels and visibility-transition labels.
- Exact mask drawing tools and editing gestures.
- Exact behavior for overlapping captured panorama sections.
- Precision requirements for narrow obstructions such as branches.
- Exact zoom thresholds and prominence rules used to reveal additional DSOs.
- Whether field-of-view-aware obstruction calculations beyond center-point visibility are included in v1.
- Exact rules for determining the observing location data required for astronomical calculations.
