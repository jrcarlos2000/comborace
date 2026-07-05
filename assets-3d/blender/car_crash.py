# Crash tumble sprite sequence: the car flips/spins with debris, transparent PNGs.
# Everything is keyframed (deterministic, fast) - no rigid-body solve.
import bpy, os, math, time, random
HERE = os.path.expanduser('~/comborace_car')
exec(open(os.path.join(HERE, 'car_common.py')).read())

SAMPLES = int(os.environ.get('SAMPLES', '80'))
RESX = int(os.environ.get('RESX', '1200'))
RESY = int(os.environ.get('RESY', '900'))
NFRAMES = int(os.environ.get('NFRAMES', '18'))
OUTDIR = os.environ.get('OUTDIR', os.path.join(HERE, 'out', 'crash'))
BODY_HEX = os.environ.get('BODY_HEX', '')
os.makedirs(OUTDIR, exist_ok=True)

body_lin = hex2lin(BODY_HEX) if BODY_HEX else BODY

scene = fresh_scene()
dark_world(scene)
three_light_rig()
parts = build_car(body_lin)
# no shadow catcher: the car goes airborne, so a baked ground shadow reads wrong
# and its shifting pool was the main per-frame brightness pop in the sprite loop

# parent all car parts to a pivot at the car's center of mass
piv = bpy.data.objects.new('pivot', None)
scene.collection.objects.link(piv)
piv.location = (0, 0, 0.55)
for p in parts:
    if p.parent is None:
        wm = p.matrix_world.copy()
        p.parent = piv
        p.matrix_world = wm

bpy.context.view_layer.objects.active = piv
piv.rotation_mode = 'XYZ'

# smooth auto-bezier arcs for all inserted keyframes (Blender 5.x slotted actions)
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'BEZIER'
bpy.context.preferences.edit.keyframe_new_handle_type = 'AUTO_CLAMPED'

# tumble keyframes: launch up, forward end-over-end flip + barrel roll, come down
key = {
    #  frame : (loc, rot_euler)
    1:  ((0.0, 0.0, 0.0),   (0.0, 0.0, 0.0)),
    6:  ((0.15, -0.9, 1.4), (math.radians(150), math.radians(60), math.radians(-15))),
    12: ((0.35, -2.1, 1.7), (math.radians(430), math.radians(180), math.radians(-40))),
    18: ((0.55, -3.3, 0.55), (math.radians(720), math.radians(300), math.radians(-70))),
}
for f, (loc, rot) in key.items():
    piv.location = loc
    piv.rotation_euler = rot
    piv.keyframe_insert('location', frame=f)
    piv.keyframe_insert('rotation_euler', frame=f)

# debris: chunks flung out on ballistic arcs with fast spin
rnd = random.Random(11)
debris_mats = [paint('d_grey', GREY, 0.7, 0.3),
               paint('d_purple', PURPLE, 0.45, 0.2),
               paint('d_carbon', CARBON, 0.25, 0.35)]
g = -9.8
for i in range(11):
    r = rnd.uniform(0.06, 0.16)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r,
                                           location=(0, 0, 0.6))
    d = bpy.context.active_object
    d.scale = (rnd.uniform(0.7, 1.6), rnd.uniform(0.7, 1.6), rnd.uniform(0.5, 1.2))
    d.data.materials.append(rnd.choice(debris_mats))
    smooth(d)
    # ballistic: p(t) = p0 + v*t + 0.5*g*t^2 ; t in seconds, 30 fps
    p0 = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.3), rnd.uniform(0.4, 0.9))
    v = (rnd.uniform(-2.0, 2.5), rnd.uniform(-4.5, -1.0), rnd.uniform(3.0, 6.5))
    spin = (rnd.uniform(-18, 18), rnd.uniform(-18, 18), rnd.uniform(-18, 18))
    d.rotation_mode = 'XYZ'
    for f in range(1, NFRAMES + 1):
        t = (f - 1) / 30.0
        z = p0[2] + v[2] * t + 0.5 * g * t * t
        z = max(z, r * 0.5)  # rest on ground
        d.location = (p0[0] + v[0] * t, p0[1] + v[1] * t, z)
        d.rotation_euler = (spin[0] * t, spin[1] * t, spin[2] * t)
        d.keyframe_insert('location', frame=f)
        d.keyframe_insert('rotation_euler', frame=f)

scene.frame_start, scene.frame_end = 1, NFRAMES
# same lens as hero but pulled back a touch to keep the arc in frame
camera(scene, loc=(6.4, 5.6, 3.1), target=(0.2, -1.4, 0.9), lens=62)
gpu_cycles(scene, samples=SAMPLES, res=(RESX, RESY))
scene.render.filepath = os.path.join(OUTDIR, 'crash_')
scene.render.use_overwrite = True

t0 = time.time()
bpy.ops.render.render(animation=True)
print(f'CRASH DONE {NFRAMES} frames in {(time.time() - t0):.1f}s -> {OUTDIR}')
