# ComboRace - stylized race-car builder + GPU scene helpers (Blender 5.1, Cycles/OPTIX).
# Loaded via exec(open('car_common.py').read()) so it works with `blender -b -P`.
# Body is a single lofted mesh (smooth, premium) + separate wheels/aero/glass.
# Livery: graphite-grey car paint with brand-purple accents (#7E5DFE / #6631F6).
import bpy, bmesh, math, os, random
from mathutils import Vector

HERE = os.path.expanduser('~/comborace_car')
HDRI = os.path.expanduser('~/hero/studio.exr')


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex2lin(h):
    h = h.lstrip('#')
    return tuple(srgb2lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


# Brand palette (linear)
PURPLE = hex2lin('7E5DFE')       # bright brand accent (stripe)
PURPLE_DEEP = hex2lin('6631F6')  # deep accent (rims/endplates)
BODY = (0.13, 0.095, 0.30)       # refined violet-grey (main panels)
GREY = (0.115, 0.115, 0.14)      # graphite (roof / upper)
CARBON = (0.010, 0.010, 0.013)   # near-black carbon
SILVER = (0.62, 0.63, 0.68)      # rim metal


def fresh_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def paint(name, color, metallic=0.7, rough=0.28, coat=1.0, coat_rough=0.08):
    """Automotive clearcoat paint material."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    for key, val in (('Coat Weight', coat), ('Coat Roughness', coat_rough)):
        if key in b.inputs:
            b.inputs[key].default_value = val
    return m


def emissive(name, color, strength=3.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    if 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def glass_dark(name='canopy'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.008, 0.008, 0.02, 1)
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Roughness'].default_value = 0.13
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = 1.0
    if 'Transmission Weight' in b.inputs:
        b.inputs['Transmission Weight'].default_value = 0.35
    return m


def smooth(obj, angle=35):
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def rbox(name, dims, loc, bevel=0.02, seg=3, mat=None, subsurf=0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = dims
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True, rotation=False)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
    if subsurf:
        s = o.modifiers.new('sub', 'SUBSURF')
        s.levels = subsurf
        s.render_levels = subsurf
    if mat:
        o.data.materials.append(mat)
    smooth(o)
    return o


def build_body(mat_body, mat_roof, mat_stripe):
    """Lofted single-mesh supercar body: violet-grey lower, graphite upper,
    bright-purple beltline stripe wrapping the whole car."""
    # stations rear(-y) -> front(+y): (y, half_width, z_bottom, z_top, roof_half_width)
    stations = [
        (-2.30, 0.66, 0.30, 0.56, 0.34),  # tail
        (-1.90, 0.92, 0.26, 0.66, 0.50),  # rear haunch
        (-1.40, 0.98, 0.26, 0.74, 0.60),  # rear deck (widest)
        (-0.85, 0.94, 0.28, 0.86, 0.58),  # cabin rear / roof
        (-0.25, 0.90, 0.28, 0.90, 0.54),  # roof apex (low)
        (0.35, 0.90, 0.27, 0.74, 0.66),   # windshield base
        (0.95, 0.94, 0.25, 0.60, 0.74),   # hood (low)
        (1.55, 0.98, 0.23, 0.52, 0.66),   # front fender (covers wheel)
        (2.05, 0.72, 0.22, 0.44, 0.46),   # front
        (2.45, 0.34, 0.24, 0.38, 0.24),   # nose tip (long, low)
    ]
    M = 10

    def ring(y, hw, zb, zt, rhw):
        mid = zb + (zt - zb) * 0.45
        sh = zt - (zt - zb) * 0.16
        shx = rhw + (hw - rhw) * 0.5
        return [
            (0.0, y, zb - 0.03),      # 0 belly
            (hw * 0.72, y, zb),       # 1 lower R
            (hw, y, mid),             # 2 belt R  (stripe)
            (shx, y, sh),             # 3 shoulder R
            (rhw, y, zt),             # 4 roof R
            (0.0, y, zt + 0.015),     # 5 roof center
            (-rhw, y, zt),            # 6 roof L
            (-shx, y, sh),            # 7 shoulder L
            (-hw, y, mid),            # 8 belt L  (stripe)
            (-hw * 0.72, y, zb),      # 9 lower L
        ]

    rings = [ring(*s) for s in stations]
    bm = bmesh.new()
    vgrid = [[bm.verts.new(p) for p in r] for r in rings]
    bm.verts.ensure_lookup_table()

    # material by ring index k: 0=body(violet-grey) lower, 1=roof(grey) upper, 2=stripe
    #   k: 0 belly,1 lowerR,2 beltR(stripe),3 shoulderR,4 roofR,5 top,6 roofL,7 shoulderL,8 beltL(stripe),9 lowerL
    def mat_for(k):
        if k in (2, 8):
            return 2  # beltline stripe
        if k in (3, 4, 5, 6):
            return 1  # upper / roof grey
        return 0      # lower body violet-grey
    for i in range(len(rings) - 1):
        for k in range(M):
            a, b = vgrid[i][k], vgrid[i][(k + 1) % M]
            c, d = vgrid[i + 1][(k + 1) % M], vgrid[i + 1][k]
            f = bm.faces.new((a, b, c, d))
            f.material_index = mat_for(k)
    bm.faces.new(list(reversed(vgrid[0]))).material_index = 0
    bm.faces.new(vgrid[-1]).material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    me = bpy.data.meshes.new('body')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('body', me)
    bpy.context.scene.collection.objects.link(o)
    for m in (mat_body, mat_roof, mat_stripe):
        o.data.materials.append(m)
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    smooth(o, 45)
    return o


def _cyl(name, radius, depth, loc, mat, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc,
                                        rotation=(0, math.radians(90), 0), vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    smooth(o)
    return o


def make_wheel(x, y, mat_tire, mat_rim, mat_cal):
    """Bored-ring tire with an inset 5-spoke alloy: dark backing (window gaps),
    silver lip ring at the bead, tapered silver spokes, deep-purple hub cap.
    The tire is hollowed so the rim reads inset instead of a spiky star poking
    through a solid outboard face."""
    parts = []
    z = 0.36
    R = 0.36                 # tire outer radius
    bore = 0.27              # inner bore (rim opening)
    hub_r = 0.085
    sign = 1.0 if x > 0 else -1.0
    face = x + sign * 0.15   # outboard tire face plane

    # tire hollowed into a ring via a boolean cut
    t = _cyl('tire', R, 0.30, (x, y, z), mat_tire, verts=64)
    cut = _cyl('tire_cut', bore, 0.42, (x, y, z), mat_tire, verts=64)
    bpy.context.view_layer.objects.active = t
    bo = t.modifiers.new('bore', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.object = cut
    bpy.ops.object.modifier_apply(modifier='bore')
    bpy.data.objects.remove(cut, do_unlink=True)
    bev = t.modifiers.new('bev', 'BEVEL')
    bev.width = 0.03
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(50)
    smooth(t, 40)
    parts.append(t)

    # dark backing closes the bore so the spoke gaps read as shadow, not the
    # transparent film behind the sprite
    parts.append(_cyl('rim_back', bore + 0.02, 0.02, (face - sign * 0.16, y, z),
                       mat_tire, verts=48))

    # silver lip ring seated in the bead
    bpy.ops.mesh.primitive_torus_add(major_radius=0.235, minor_radius=0.028,
                                     location=(face - sign * 0.06, y, z),
                                     major_segments=48, minor_segments=12,
                                     rotation=(0, math.radians(90), 0))
    lip = bpy.context.active_object
    lip.name = 'rim_lip'
    lip.data.materials.append(mat_rim)
    smooth(lip)
    parts.append(lip)

    # 5 tapered silver spokes bridging hub -> lip, sitting over the dark backing
    inner, outer = hub_r, 0.25
    mid = (inner + outer) * 0.5
    span = outer - inner
    sp_x = face - sign * 0.09
    for s in range(5):
        a = s * (2 * math.pi / 5)
        dy, dz = math.cos(a), math.sin(a)
        sp = rbox('spoke', (0.05, span, 0.05), (sp_x, y + mid * dy, z + mid * dz),
                  bevel=0.014, mat=mat_rim, rot=(a, 0, 0))
        parts.append(sp)

    # domed deep-purple hub cap, inset just behind the tire face
    parts.append(_cyl('hub', hub_r, 0.07, (face - sign * 0.055, y, z), mat_cal, verts=32))
    return parts


def build_car(body_lin=BODY):
    """Build the full car at origin (wheels on z=0). Returns list of all objects.

    body_lin is the per-player main-body color in linear RGB; the roof grey and
    the brand-purple accents stay fixed so every car reads as the same brand.
    """
    # low metallic + light clearcoat = true-color car paint (not chrome)
    body = paint('body_main', body_lin, metallic=0.15, rough=0.30, coat=0.45)
    roof = paint('roof_grey', GREY, metallic=0.15, rough=0.32, coat=0.45)
    purple = paint('purple_acc', PURPLE, metallic=0.1, rough=0.20, coat=0.5)
    deep = paint('purple_deep', PURPLE_DEEP, metallic=0.2, rough=0.22, coat=0.5)
    carbon = paint('carbon', CARBON, metallic=0.1, rough=0.34, coat=0.6, coat_rough=0.2)
    tire = paint('tire', (0.012, 0.012, 0.014), metallic=0.0, rough=0.85, coat=0.0)
    rim = paint('rim', SILVER, metallic=1.0, rough=0.17, coat=0.0)
    glass = glass_dark()

    objs = []
    objs.append(build_body(body, roof, purple))

    # dark tinted canopy over the cabin (low, raked)
    can = rbox('canopy', (1.02, 1.7, 0.44), (0.0, -0.02, 0.80),
               bevel=0.12, seg=4, mat=glass, subsurf=2)
    objs.append(can)

    # front splitter (carbon) with purple lip
    objs.append(rbox('splitter', (1.9, 0.6, 0.06), (0, 2.05, 0.15), bevel=0.02, mat=carbon))
    objs.append(rbox('splitter_lip', (1.7, 0.10, 0.05), (0, 2.35, 0.14), bevel=0.02, mat=purple))
    # side skirts
    for sx in (0.94, -0.94):
        objs.append(rbox('skirt', (0.10, 2.2, 0.13), (sx, -0.05, 0.20), bevel=0.03, mat=carbon))
    # rear diffuser
    objs.append(rbox('diffuser', (1.6, 0.5, 0.16), (0, -2.15, 0.20), bevel=0.02, mat=carbon))

    # rear wing: struts + plane + purple endplates
    for sx in (0.5, -0.5):
        objs.append(rbox('wstrut', (0.07, 0.18, 0.38), (sx, -2.15, 0.86), bevel=0.02, mat=carbon))
    objs.append(rbox('wing', (1.72, 0.5, 0.06), (0, -2.22, 1.05), bevel=0.02, mat=carbon))
    for sx in (0.87, -0.87):
        objs.append(rbox('endplate', (0.05, 0.58, 0.30), (sx, -2.22, 0.98), bevel=0.02, mat=deep))

    # side mirrors
    for sx in (0.88, -0.88):
        objs.append(rbox('mirror', (0.10, 0.16, 0.09), (sx, 0.40, 0.80), bevel=0.03, mat=purple))

    # brand-purple light strips (headlights / taillights)
    led = emissive('led', PURPLE, strength=6.0)
    led_deep = emissive('led_deep', PURPLE_DEEP, strength=5.0)
    for sx in (0.5, -0.5):
        objs.append(rbox('headlight', (0.34, 0.04, 0.05), (sx, 2.24, 0.42), bevel=0.01, mat=led))
    objs.append(rbox('taillight', (1.2, 0.04, 0.05), (0, -2.32, 0.58), bevel=0.01, mat=led_deep))

    # wheels (tucked under the fenders)
    for (x, y) in ((0.86, 1.40), (-0.86, 1.40), (0.86, -1.50), (-0.86, -1.50)):
        objs.extend(make_wheel(x, y, tire, rim, deep))

    return objs


def gpu_cycles(scene, samples=128, res=(1500, 1050)):
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type != 'CPU'
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = True
    scene.render.fps = 30
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15
    # punchy, true-to-brand colors for a game sprite (AgX mutes the purple)
    try:
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
    except Exception:
        pass
    scene.view_settings.exposure = -0.15


def dark_world(scene, strength=0.05, color=(0.018, 0.020, 0.030)):
    """Dark 'studio on black' environment so paint color dominates and glossy
    surfaces show clean light streaks instead of a white softbox wash."""
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    bg.inputs['Color'].default_value = (*color, 1)
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def area_light(name, loc, target, energy, size=6.0, color=(1, 1, 1), size_y=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    if size_y is not None:
        ld.shape = 'RECTANGLE'
        ld.size = size
        ld.size_y = size_y
    else:
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    t = bpy.data.objects.new(name + '_t', None)
    t.location = target
    bpy.context.scene.collection.objects.link(t)
    o.constraints.new('TRACK_TO').target = t
    return o


def three_light_rig():
    area_light('key', (5.5, 4.5, 6.0), (0, 0, 0.6), 600, size=4, color=(1.0, 0.97, 0.92))
    area_light('fill', (-6.0, 2.0, 3.0), (0, 0, 0.6), 260, size=5, color=(0.92, 0.94, 1.0))
    area_light('rim', (-3.0, -6.5, 3.2), (0, 0, 0.7), 850, size=3.5, color=(0.78, 0.70, 1.0))
    # long overhead strips -> signature reflection streaks on hood/roof
    area_light('strip_top', (1.2, 0.4, 5.2), (0, 0, 0.6), 750, size=0.4, size_y=4.5,
               color=(1, 1, 1))
    area_light('strip_side', (4.2, -0.6, 2.6), (0, 0, 0.55), 480, size=0.35, size_y=3.4,
               color=(0.95, 0.95, 1.0))


def camera(scene, loc, target, lens=68):
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    o = bpy.data.objects.new('cam', cam)
    o.location = loc
    scene.collection.objects.link(o)
    scene.camera = o
    t = bpy.data.objects.new('cam_t', None)
    t.location = target
    scene.collection.objects.link(t)
    o.constraints.new('TRACK_TO').target = t
    return o


def shadow_catcher(size=40):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    p = bpy.context.active_object
    p.name = 'catcher'
    p.is_shadow_catcher = True
    return p
