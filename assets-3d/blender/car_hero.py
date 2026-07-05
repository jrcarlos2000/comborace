# Hero render: single car, three-quarter front angle, transparent PNG.
import bpy, os, time
HERE = os.path.expanduser('~/comborace_car')
exec(open(os.path.join(HERE, 'car_common.py')).read())

SAMPLES = int(os.environ.get('SAMPLES', '160'))
RESX = int(os.environ.get('RESX', '1600'))
RESY = int(os.environ.get('RESY', '1200'))
OUT = os.environ.get('OUT', os.path.join(HERE, 'out', 'car_hero.png'))
BODY_HEX = os.environ.get('BODY_HEX', '')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

body_lin = hex2lin(BODY_HEX) if BODY_HEX else BODY

scene = fresh_scene()
dark_world(scene)
three_light_rig()
build_car(body_lin)
shadow_catcher()
camera(scene, loc=(5.8, 5.4, 2.4), target=(0.0, -0.1, 0.5), lens=72)
gpu_cycles(scene, samples=SAMPLES, res=(RESX, RESY))
scene.render.filepath = OUT

t0 = time.time()
bpy.ops.render.render(write_still=True)
print(f'HERO DONE {OUT} in {time.time() - t0:.1f}s')
