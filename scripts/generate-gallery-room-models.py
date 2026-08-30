import math
import os
import sys

import bpy


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "public", "models", "gallery-rooms")

# EK's ask (2026-08-28): vault's own front/door wall (and everything mounted
# to it) got pushed this far further out to give the room real extra depth —
# see add_vault_door()'s own comment for the full reasoning. Module-level
# because add_wall_panels() also builds a front baseboard shared by every
# style, and vault's copy of that piece needs to move with the wall too, or
# it's left floating at the wall's OLD position.
VAULT_FRONT_WALL_PUSH_BACK = 1.5


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_mat(name, color, roughness=0.65, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        # The 4th component of `color` is alpha, but Base Color's own alpha
        # channel isn't what the glTF exporter reads for transparency — it
        # reads the Principled BSDF's separate "Alpha" socket, which this
        # never touched, so every "glass" material (alpha 0.22-0.24 in the
        # style dicts below) was exporting fully opaque (alpha 1) regardless.
        # That's why display-case glass read as solid/whited-out instead of
        # clear, worst in the White room where an opaque near-white panel is
        # indistinguishable from the wall behind it.
        alpha = color[3] if len(color) > 3 else 1.0
        bsdf.inputs["Alpha"].default_value = alpha
        if alpha < 1.0:
            mat.blend_method = "BLEND"
            mat.show_transparent_back = False
    return mat


def app_loc(loc):
    # App/Three uses X right, Y up, Z depth. Blender authors X right, Z up,
    # Y depth; glTF export then maps Blender Z back to glTF Y. Build in app
    # coordinates everywhere else and convert only at object creation.
    x, y, z = loc
    return (x, -z, y)


def app_scale(scale):
    sx, sy, sz = scale
    return (sx, sz, sy)


def cylinder_axis_from_three_rotation(rot):
    if abs((rot[0] % (math.pi * 2)) - (math.pi / 2)) < 0.001:
        return "z"
    if abs((rot[1] % (math.pi * 2)) - (math.pi / 2)) < 0.001:
        return "x"
    return "y"


def blender_cylinder_rotation(axis):
    if axis == "x":
        return (0, math.pi / 2, 0)
    if axis == "z":
        return (math.pi / 2, 0, 0)
    return (0, 0, 0)


def cube(name, loc, scale, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=app_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = app_scale(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("soft_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.affect = "EDGES"
        obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    # Plain `.parent =` (not the "Keep Transform" operator) leaves
    # matrix_parent_inverse at identity, so `loc` above is reinterpreted as
    # LOCAL to `parent` once this is set — the object's actual world
    # position becomes loc + parent's own position. This is what lets a
    # whole assembly (see add_vault_door's anchor) move as one unit by
    # changing only the anchor, instead of every piece's own coordinate.
    if parent is not None:
        obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, mat, vertices=96, rot=(0, 0, 0), bevel=False, parent=None):
    axis = cylinder_axis_from_three_rotation(rot)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=app_loc(loc),
        rotation=blender_cylinder_rotation(axis),
    )
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("soft_bevel", "BEVEL")
        mod.width = 0.025
        mod.segments = 3
        obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    if parent is not None:
        obj.parent = parent
    return obj


def torus(name, loc, major, minor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=96,
        minor_segments=12,
        location=app_loc(loc),
        major_radius=major,
        minor_radius=minor,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    return obj


def arch_curve(name, center, radius, mat, bevel_depth=0.08, start=math.pi, end=0.0, steps=40, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 5
    spline = curve.splines.new("POLY")
    spline.points.add(steps)
    cx, cy, cz = center
    for index in range(steps + 1):
        angle = start + (end - start) * (index / steps)
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius
        z = cz
        bx, by, bz = app_loc((x, y, z))
        spline.points[index].co = (bx, by, bz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    # See cube()'s own comment — the curve's points above are baked in
    # object-local space (this object's own .location defaults to origin),
    # so parenting shifts the whole curve by the parent's position exactly
    # like a cube would, with no extra math needed here.
    if parent is not None:
        obj.parent = parent
    return obj


def add_wall_panels(style, mats):
    wall = mats["wall"]
    trim = mats["trim"]
    floor = mats["floor"]
    ceiling = mats["ceiling"]

    cube("floor_slab", (0, -0.08, -3.2), (21.0, 0.16, 26.0), floor, 0.015)
    cube("back_wall", (0, 4.55, -12.08), (21.0, 9.2, 0.18), wall, 0.012)
    cube("left_wall", (-10.58, 4.55, -3.2), (0.18, 9.2, 26.0), wall, 0.012)
    cube("right_wall", (10.58, 4.55, -3.2), (0.18, 9.2, 26.0), wall, 0.012)
    cube("ceiling", (0, 9.18, -3.2), (21.0, 0.16, 26.0), ceiling, 0.01)

    # Architectural trim and recessed wall panels create real depth instead of flat planes.
    panel = mats.get("panel_seam", trim)
    cube("baseboard_back", (0, 0.22, -11.95), (20.7, 0.26, 0.14), trim, 0.025)
    # EK's ask (2026-08-28): "wall trim is going in front of the door."
    # This used to loop the SAME unbroken 20.7-wide baseboard over both the
    # back wall AND the front/door wall — but only the front wall has a real
    # doorway opening, so that strip ran straight across the passage with no
    # gap at all. Split it around the door instead, matching the fallback
    # shell's own frontBaseboardLeft/frontBaseboardRight
    # (VirtualGalleryRoom.tsx) exactly (same 8.6 width, same +-6.13 center) so
    # the baked model and the shell finally agree here.
    # Vault's own front wall moved (VAULT_FRONT_WALL_PUSH_BACK, see top of
    # file) — this baseboard has to move with it or it's left floating at
    # the wall's old position. whitebox/arcade's front wall never moved, so
    # their baseboard stays put.
    front_baseboard_z = 5.72 + (VAULT_FRONT_WALL_PUSH_BACK if style == "vault" else 0)
    cube("baseboard_front_left", (-6.13, 0.22, front_baseboard_z), (8.6, 0.26, 0.14), trim, 0.025)
    cube("baseboard_front_right", (6.13, 0.22, front_baseboard_z), (8.6, 0.26, 0.14), trim, 0.025)
    cube("baseboard_left", (-10.36, 0.22, -3.05), (0.14, 0.26, 23.4), trim, 0.025)
    cube("baseboard_right", (10.36, 0.22, -3.05), (0.14, 0.26, 23.4), trim, 0.025)

    for x in [-7.0, -3.5, 0.0, 3.5, 7.0]:
        cube(f"back_panel_stile_{x}", (x, 4.55, -11.88), (0.06, 7.1, 0.1), panel, 0.012)
    # Was width 20.0 (half-width 10.0), 0.36 short of the side walls' own
    # panel posts at x=+-10.36 — the horizontal back-wall trim line stopped
    # short of the corner instead of meeting the vertical side-wall trim,
    # a visible gap at every corner on every style except Blue (which has
    # no GLB at all). Widened to reach exactly where the side posts are.
    for y in [1.2, 4.2, 7.2]:
        cube(f"back_panel_rail_{y}", (0, y, -11.87), (20.72, 0.06, 0.1), panel, 0.012)
    for side, x in [("left", -10.36), ("right", 10.36)]:
        for z in [-9.0, -4.8, -0.6, 3.6]:
            cube(f"{side}_panel_stile_{z}", (x, 4.55, z), (0.1, 7.0, 0.06), panel, 0.012)
        for y in [1.2, 4.2, 7.2]:
            cube(f"{side}_panel_rail_{y}", (x, y, -3.2), (0.1, 0.06, 24.0), panel, 0.012)

    # Shelf boards are part of the authored room model, not procedural app geometry.
    # EK's ask (2026-08-21), corrected a 4th time — must exactly match
    # SHELF_ROW_Y in VirtualGalleryRoom.tsx. Final: top row unchanged,
    # middle/bottom rows dropped 0.25 each to open real headroom above
    # each item (the item's own top edge was flush against the board
    # above it at the old 1.25 spacing) — item SIZE untouched, only the
    # shelf spacing changed. See that constant's comment for the full
    # reasoning. Drifting these two out of sync floats items off the shelf.
    shelf_y = [4.72, 3.22, 1.72]
    for i, y in enumerate(shelf_y):
        cube(f"back_shelf_{i}", (0, y, -11.62), (19.9, 0.12, 0.72), trim, 0.035)
        cube(f"left_shelf_{i}", (-10.12, y, -3.15), (0.72, 0.12, 23.2), trim, 0.035)
        cube(f"right_shelf_{i}", (10.12, y, -3.15), (0.72, 0.12, 23.2), trim, 0.035)

    # EK circled this repeatedly across two rounds — first the rail width,
    # then baseboard, now shelves too — always at the same two back
    # corners. Chasing exact width/depth matches between separate back/side
    # pieces is fragile: get any one of them a hair off and there's a new
    # visible seam. A single solid corner post spanning the full room
    # height, generously sized to overlap every row of shelf/rail/baseboard
    # on both walls at once, makes the corner unconditionally flush instead
    # of depending on multiple pieces lining up exactly.
    for x in [-10.36, 10.36]:
        cube(f"back_corner_post_{x}", (x, 4.6, -11.87), (1.3, 9.15, 1.3), trim, 0.03)


def add_floor_planks(mats):
    tones = mats["floor_tones"]
    z_start = -15.6
    row = 0
    z = z_start
    while z < 9.0:
        x = -10.25 + (0.75 if row % 2 else 0)
        col = 0
        while x < 10.5:
            length = 1.45 + ((col + row) % 4) * 0.22
            mat = tones[(col + row) % len(tones)]
            cube(f"floor_plank_{row}_{col}", (x + length / 2, 0.01, z), (length - 0.025, 0.035, 0.34), mat, 0.006)
            x += length
            col += 1
        z += 0.34
        row += 1


def add_cases(mats):
    case_mat = mats["case"]
    glass = mats["glass"]
    trim = mats["trim"]
    spots = [(-3.4, -3.5), (0, -4.55), (3.4, -3.5), (-2.1, 0.45), (2.1, 0.45)]
    for i, (x, z) in enumerate(spots):
        cube(f"display_case_base_{i}", (x, 0.31, z), (1.42, 0.72, 1.12), case_mat, 0.045)
        cube(f"display_case_glass_{i}", (x, 1.25, z), (1.3, 1.15, 1.0), glass, 0.025)
        cube(f"display_case_cap_{i}", (x, 1.85, z), (1.48, 0.08, 1.18), trim, 0.02)


def add_standard_door(mats):
    trim = mats["trim"]
    wall = mats["door_wall"]
    cube("front_wall_left", (-6.13, 4.55, 5.8), (8.75, 9.2, 0.18), wall, 0.012)
    cube("front_wall_right", (6.13, 4.55, 5.8), (8.75, 9.2, 0.18), wall, 0.012)
    cube("front_wall_top", (0, 7.08, 5.8), (3.5, 4.25, 0.18), wall, 0.012)
    cube("door_left", (-1.85, 2.45, 5.62), (0.18, 4.95, 0.22), trim, 0.025)
    cube("door_right", (1.85, 2.45, 5.62), (0.18, 4.95, 0.22), trim, 0.025)
    cube("door_header", (0, 4.92, 5.62), (3.85, 0.18, 0.22), trim, 0.025)
    cube("vestibule_wall", (0, 2.5, 8.6), (3.6, 4.8, 0.16), mats["vestibule"], 0.012)


def add_vault_door(mats):
    steel = mats["steel"]
    dark = mats["dark_steel"]
    brass = mats["brass"]
    wall = mats["wall"]
    black = mats["black"]

    # EK's ask (2026-08-28), the one thing that matters right now: the room
    # reads as smaller since the door assembly was pulled flush with this
    # wall earlier tonight (it used to float forward, into the room, which
    # is what made the entrance feel deeper/more open even though it wasn't
    # actually touching anything). Pushing the wall itself further out gives
    # the room real extra depth instead of relying on a detached door for
    # that feeling. door_anchor (below) carries the whole door assembly
    # back with it by the same amount, so it stays flush with the wall's
    # NEW position rather than reopening the gap that was just closed.
    FRONT_WALL_PUSH_BACK = VAULT_FRONT_WALL_PUSH_BACK
    # Room-side vault entrance only. The heavy round vault door belongs outside
    # this room, so this model intentionally contains no interior round door.
    cube("vault_front_wall_left", (-6.5, 4.55, 5.8 + FRONT_WALL_PUSH_BACK), (8.0, 9.2, 0.18), wall, 0.012)
    cube("vault_front_wall_right", (6.5, 4.55, 5.8 + FRONT_WALL_PUSH_BACK), (8.0, 9.2, 0.18), wall, 0.012)
    cube("vault_front_wall_top", (0, 7.0, 5.8 + FRONT_WALL_PUSH_BACK), (4.98, 4.3, 0.18), wall, 0.012)
    # Continue the same panel system used on the other walls so the entrance
    # reads as part of the room instead of a separate decorative insert.
    for x in [-10.36, -7.0, -3.5, 3.5, 7.0, 10.36]:
        cube(f"vault_front_panel_stile_{x}", (x, 4.45, 5.62 + FRONT_WALL_PUSH_BACK), (0.055, 6.95, 0.1), mats["panel_seam"], 0.01)
    for y in [1.2, 4.2, 7.2]:
        cube(f"vault_front_panel_rail_left_{y}", (-6.48, y, 5.62 + FRONT_WALL_PUSH_BACK), (7.75, 0.055, 0.1), mats["panel_seam"], 0.01)
        cube(f"vault_front_panel_rail_right_{y}", (6.48, y, 5.62 + FRONT_WALL_PUSH_BACK), (7.75, 0.055, 0.1), mats["panel_seam"], 0.01)
    # EK's ask (2026-08-29): "the frame needs to be remade separate from
    # the wall" -- every piece below (plate, posts, arch, reveals,
    # threshold, rivets) used to carry its own "+ DOOR_Z_SHIFT" addition,
    # a manual habit that's exactly how the JS-side item hangers got
    # forgotten across two separate push-back rounds (nothing enforced
    # that every new piece, or every OTHER file's copy of this offset,
    # actually included it). This anchor is a real Blender parent: every
    # door-frame piece below is created at its own plain, "obvious" local
    # coordinate (the same numbers that used to need "+ DOOR_Z_SHIFT"
    # tacked on, now without it) and parented to `door_anchor`. Moving the
    # WHOLE frame, independent of the wall, is one change to
    # DOOR_ANCHOR_Z -- not 40+ scattered edits, and not something a future
    # change can silently forget for a handful of pieces.
    #
    # DOOR_ANCHOR_Z folds in the 0.06 fine-tune from EK's original ask —
    # vault_rear_left/right_reveal (the innermost recess lining, and by
    # design the piece meant to actually touch the wall) sat 0.06 short of
    # the wall's near face (5.8 - half its own 0.18 thickness = 5.71) — on
    # top of tracking the wall's own push-back so the frame stays flush
    # with wherever the wall currently sits.
    DOOR_ANCHOR_Z = 0.06 + FRONT_WALL_PUSH_BACK
    door_anchor = bpy.data.objects.new("vault_door_anchor", None)
    door_anchor.location = app_loc((0, 0, DOOR_ANCHOR_Z))
    bpy.context.collection.objects.link(door_anchor)
    # EK's ask (2026-08-28), a second real gap on the same screenshot: the
    # outer decorative plate's inner edge (x -1.90 at the old 0.52 width)
    # fell 0.05 units short of vault_left_post's own outer edge (x -1.85) -
    # a real, measured seam, not an intentional reveal (nothing else in
    # this assembly is designed to show a gap there). Widened both plates
    # by 0.14 (symmetric, so 0.07 outward) so the inner edge now overlaps
    # the post by 0.02 instead of falling short of it.
    #
    # EK, after that: "still the same gap" - the X fix alone wasn't enough.
    # Pulled the plate's own full 3D bounding box directly from the
    # exported GLB (not guessed) and found a SECOND, separate gap on the
    # same joint: the plate's near (room-facing) surface sat at z=5.43
    # while the post's far surface only reached z=5.38 - a 0.05 gap in
    # DEPTH, invisible to the X-only check, which reads as the exact same
    # dark seam from most viewing angles. Moved the plate's own local z
    # from 5.48 to 5.41 so its near face now overlaps the post's far face
    # by 0.02, matching the X fix's own margin.
    # EK's ask (2026-08-29): "the door frame is still off the wall." Real
    # measured gap, not a guess: the plates' own back face only reached
    # local z=5.52 (5.41 + half its 0.22 depth), while the wall's near
    # face sits at local z=5.65 relative to this anchor (the wall's real
    # z, 5.71 + FRONT_WALL_PUSH_BACK, minus the anchor's own 0.06+
    # FRONT_WALL_PUSH_BACK offset — the anchor's math cancels the shared
    # push-back term out, so this 5.65 stays correct no matter how far the
    # wall moves in the future, exactly the point of building this as one
    # anchored unit). Deepened each plate so its back face now reaches
    # that same 5.65, closing the visible gap, while keeping its FRONT
    # face (the visible surface) exactly where it was.
    cube("vault_plate_left", (-2.16, 2.48, 5.475), (0.66, 4.9, 0.35), steel, 0.035, parent=door_anchor)
    cube("vault_plate_right", (2.16, 2.48, 5.475), (0.66, 4.9, 0.35), steel, 0.035, parent=door_anchor)
    cube("vault_plate_top", (0, 5.02, 5.51), (4.32, 0.3, 0.28), steel, 0.035, parent=door_anchor)
    arch_curve("vault_arch_outer_trim", (0, 3.18, 5.19), 2.0, steel, 0.08, parent=door_anchor)
    arch_curve("vault_arch_inner_trim", (0, 3.18, 5.06), 1.66, dark, 0.055, parent=door_anchor)
    cube("vault_left_post", (-1.74, 1.58, 5.2), (0.22, 3.18, 0.24), steel, 0.028, parent=door_anchor)
    cube("vault_right_post", (1.74, 1.58, 5.2), (0.22, 3.18, 0.24), steel, 0.028, parent=door_anchor)
    cube("vault_inner_left_reveal", (-1.48, 1.62, 4.95), (0.28, 3.25, 0.55), dark, 0.02, parent=door_anchor)
    cube("vault_inner_right_reveal", (1.48, 1.62, 4.95), (0.28, 3.25, 0.55), dark, 0.02, parent=door_anchor)
    cube("vault_rear_left_reveal", (-1.25, 1.7, 5.65), (0.18, 3.4, 1.0), dark, 0.018, parent=door_anchor)
    cube("vault_rear_right_reveal", (1.25, 1.7, 5.65), (0.18, 3.4, 1.0), dark, 0.018, parent=door_anchor)
    cube("vault_threshold", (0, 0.06, 5.2), (3.65, 0.12, 0.36), dark, 0.018, parent=door_anchor)
    cube("vault_vestibule_floor", (0, 0.04, 6.35 + FRONT_WALL_PUSH_BACK), (3.0, 0.08, 2.25), mats["floor"], 0.012)
    cube("vault_vestibule_wall", (0, 2.6, 8.75 + FRONT_WALL_PUSH_BACK), (3.5, 5.2, 0.16), mats["vestibule"], 0.012)

    for i in range(24):
        angle = math.pi * i / 23.0
        x = math.cos(angle) * 1.98
        y = 3.25 + math.sin(angle) * 1.98
        if y >= 3.18:
            cyl(f"vault_arch_rivet_{i}", (x, y, 5.15), 0.045, 0.06, brass, 16, (math.pi / 2, 0, 0), True, parent=door_anchor)
    # EK circled this same spot a 4th time: "still all the same issues." The
    # actual visible element there is this rivet column, not the plate
    # itself - pulled its real bounding box and found it was NEVER actually
    # touching the plate, in either X or Z, since before any of tonight's
    # fixes (x -2.58 sat 0.045 outside the plate's own edge; z 5.15 sat
    # 0.105 short of the plate's near face). Moved the rivets onto the
    # plate's actual surface: x=-2.35/2.35 (comfortably inside the plate's
    # x -2.49..-1.83 span, near its outer edge) and z so they protrude
    # 0.06 from the plate's own near face instead of floating in front of
    # it with nothing behind them.
    for side, x in [("left", -2.35), ("right", 2.35)]:
        for i in range(8):
            cyl(f"vault_side_rivet_{side}_{i}", (x, 0.62 + i * 0.54, 5.27), 0.045, 0.06, brass, 16, (math.pi / 2, 0, 0), True, parent=door_anchor)


def style_mats(style):
    if style == "vault":
        floor_tones = [make_mat(f"vault_floor_{i}", c, 0.52, 0.0) for i, c in enumerate([
            (0.25, 0.16, 0.10, 1), (0.34, 0.22, 0.13, 1), (0.19, 0.12, 0.08, 1), (0.38, 0.25, 0.15, 1)
        ])]
        return {
            "wall": make_mat("brushed steel vault wall", (0.46, 0.48, 0.48, 1), 0.38, 0.78),
            "door_wall": make_mat("brushed steel vault entry wall", (0.46, 0.48, 0.48, 1), 0.38, 0.78),
            "panel_seam": make_mat("dark recessed steel seams", (0.13, 0.145, 0.15, 1), 0.56, 0.72),
            "vestibule": make_mat("shadowed steel vestibule", (0.18, 0.2, 0.2, 1), 0.58, 0.55),
            "ceiling": make_mat("dark charcoal ceiling", (0.045, 0.048, 0.05, 1), 0.88, 0.0),
            "trim": make_mat("brushed gunmetal shelf trim", (0.54, 0.58, 0.59, 1), 0.34, 0.82),
            "floor": floor_tones[0],
            "floor_tones": floor_tones,
            "case": make_mat("charcoal case", (0.11, 0.13, 0.15, 1), 0.42, 0.18),
            "glass": make_mat("soft gallery glass", (0.55, 0.85, 1.0, 0.24), 0.04, 0.0),
            "steel": make_mat("brushed vault steel", (0.62, 0.64, 0.62, 1), 0.28, 0.92),
            "dark_steel": make_mat("dark brushed inset steel", (0.24, 0.26, 0.26, 1), 0.42, 0.86),
            "brass": make_mat("brushed steel rivets", (0.72, 0.76, 0.76, 1), 0.3, 0.9),
            "black": make_mat("black iron bars", (0.01, 0.011, 0.012, 1), 0.62, 0.65),
        }
    if style == "whitebox":
        # Darkened further — the first round of darkening was correct on
        # paper (confirmed via the exported material data) but still read
        # as pale in the live app after lighting, per EK's direct
        # screenshot. Rather than keep chasing this through light values
        # alone, gave the floor more margin too.
        # First pass warmed this toward walnut-brown and overshot — EK,
        # looking at the live result: "the other areas are more Tan now
        # ... make them more off white and not tan." Walls are untouched
        # (EK: "leave the walls"); trim/floor pulled back to a light,
        # LOW-SATURATION off-white/greige (R/G/B close together) instead
        # of a saturated brown — still a shade darker than the wall for
        # the contrast EK asked for earlier ("big difference needed"),
        # just not a wood-tone difference.
        floor_tones = [make_mat(f"white_floor_{i}", c, 0.5, 0.0) for i, c in enumerate([
            (0.60, 0.58, 0.53, 1), (0.66, 0.64, 0.59, 1), (0.52, 0.50, 0.46, 1), (0.70, 0.68, 0.62, 1)
        ])]
        return {
            "wall": make_mat("warm plaster gallery wall", (0.86, 0.82, 0.72, 1), 0.86, 0.0),
            "door_wall": make_mat("cream entry wall", (0.82, 0.78, 0.68, 1), 0.85, 0.0),
            # Was (0.74, 0.68, 0.56) — barely different from the wall (0.86,
            # 0.82, 0.72), so the space glimpsed through the open doorway
            # just blended into the room instead of reading as its own space
            # beyond it. Every other style already has a much darker
            # vestibule than its wall (vault: 0.46 wall -> 0.18 vestibule);
            # White had almost no contrast at all.
            "vestibule": make_mat("shadowed cream vestibule", (0.34, 0.29, 0.24, 1), 0.82, 0.0),
            "ceiling": make_mat("cream ceiling", (0.9, 0.87, 0.78, 1), 0.86, 0.0),
            # Was (0.78, 0.73, 0.62) — 0.08 off the wall's (0.86, 0.82,
            # 0.72), essentially invisible once lit. EK's ask: "big
            # difference needed." This is shelves, baseboards, and case
            # caps — everything that needs to read as distinct trim, not
            # more wall.
            # Darkened again — 0.42 base was still reading pale in the live
            # app after lighting (confirmed by EK's screenshot, not
            # assumed). Going further this round instead of another small
            # nudge.
            "trim": make_mat("off-white carved trim", (0.62, 0.60, 0.55, 1), 0.55, 0.0),
            # Was missing entirely — add_wall_panels() falls back to `trim`
            # for panel_seam when a style doesn't define one, so the
            # architrave/molding division lines were the same near-wall
            # tone too. A distinct, darker value gives the corner moldings
            # EK asked for ("corners need to be highlighted slightly
            # darker") instead of everything blending into one flat white.
            "panel_seam": make_mat("recessed molding shadow", (0.28, 0.24, 0.19, 1), 0.7, 0.0),
            "floor": floor_tones[0],
            "floor_tones": floor_tones,
            "case": make_mat("light stone case", (0.72, 0.74, 0.72, 1), 0.46, 0.08),
            "glass": make_mat("clear museum glass", (0.76, 0.92, 1.0, 0.22), 0.03, 0.0),
        }
    floor_tones = [make_mat(f"arcade_floor_{i}", c, 0.42, 0.08) for i, c in enumerate([
        (0.05, 0.045, 0.075, 1), (0.08, 0.05, 0.12, 1), (0.03, 0.035, 0.06, 1), (0.11, 0.06, 0.13, 1)
    ])]
    return {
        "wall": make_mat("deep arcade wall", (0.035, 0.025, 0.06, 1), 0.74, 0.0),
        "door_wall": make_mat("arcade entry wall", (0.025, 0.02, 0.04, 1), 0.72, 0.0),
        "vestibule": make_mat("arcade vestibule", (0.02, 0.018, 0.04, 1), 0.78, 0.0),
        "ceiling": make_mat("arcade ceiling", (0.025, 0.018, 0.04, 1), 0.8, 0.0),
        "trim": make_mat("arcade bronze trim", (0.8, 0.42, 0.14, 1), 0.36, 0.68),
        "floor": floor_tones[0],
        "floor_tones": floor_tones,
        "case": make_mat("dark arcade case", (0.09, 0.09, 0.13, 1), 0.38, 0.24),
        "glass": make_mat("cyan arcade glass", (0.25, 0.85, 1.0, 0.24), 0.02, 0.0),
    }


def add_lights(style):
    if style == "whitebox":
        color = (1.0, 0.89, 0.72)
        energy = 520
    elif style == "arcade":
        color = (0.3, 0.82, 1.0)
        energy = 420
    else:
        color = (1.0, 0.78, 0.48)
        energy = 480
    for i, x in enumerate([-6.0, -2.0, 2.0, 6.0]):
        bpy.ops.object.light_add(type="AREA", location=(x, 8.65, -7.8 + (i % 2) * 6.0))
        light = bpy.context.object
        light.name = f"{style}_softbox_{i}"
        light.data.energy = energy
        light.data.size = 3.2
        light.data.color = color
    bpy.ops.object.light_add(type="AREA", location=(0, 7.6, 3.8))
    light = bpy.context.object
    light.name = f"{style}_entry_wash"
    light.data.energy = energy * 0.75
    light.data.size = 3.8
    light.data.color = color


def build_room(style):
    clear_scene()
    mats = style_mats(style)
    add_wall_panels(style, mats)
    add_floor_planks(mats)
    add_cases(mats)
    if style == "vault":
        add_vault_door(mats)
    else:
        add_standard_door(mats)
    add_lights(style)

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = 0
    bpy.context.scene.view_settings.gamma = 1

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{style}-room.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_apply=True,
        export_lights=True,
        export_materials="EXPORT",
        export_cameras=False,
    )
    print(out_path)


if __name__ == "__main__":
    styles = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else ["vault", "whitebox", "arcade"]
    for style in styles:
        build_room(style)
