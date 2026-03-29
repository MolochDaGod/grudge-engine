/* flame.compute.wgsl
 * Procedural volumetric flame via WebGPU compute shader.
 * Reads the rendered frame + depth, writes flame pixels in-place.
 * Bindings mirror the NodeRenderGraph "2X6FE4#1" compute block.
 */

@group(0) @binding(0) var screen          : texture_storage_2d<rgba16float, read_write>;
@group(0) @binding(1) var bilinear_repeat : sampler;
@group(0) @binding(2) var channel0        : texture_2d<f32>;   // noise
@group(0) @binding(4) var depth           : texture_depth_2d;

struct Params {
    posFlame   : vec4f,   // .xy = screen px, .z = NDC depth, .w = view-space z
    elapsedTime: f32,
};
@group(0) @binding(3) var<uniform> params : Params;

// ── Value noise ─────────────────────────────────────────────────────────────
fn hash2(p: vec2f) -> f32 {
    var q = fract(p * vec2f(0.1031, 0.103));
    q += dot(q, q.yx + 33.33);
    return fract((q.x + q.y) * q.x);
}

fn vnoise(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash2(i),               hash2(i + vec2f(1.0, 0.0)), u.x),
        mix(hash2(i + vec2f(0.0,1.0)), hash2(i + vec2f(1.0,1.0)), u.x),
        u.y);
}

fn fbm(p_in: vec2f) -> f32 {
    var p = p_in;
    var val = 0.0;
    var amp = 0.5;
    for (var i = 0; i < 6; i++) {
        val += amp * vnoise(p);
        p   *= 2.1;
        amp *= 0.48;
    }
    return val;
}

// ── Colour ramp: dark red → orange → yellow-white ───────────────────────────
fn flameColor(t: f32) -> vec3f {
    let c0 = vec3f(0.05, 0.0,  0.0);   // ember
    let c1 = vec3f(0.9,  0.15, 0.0);   // orange
    let c2 = vec3f(1.0,  0.7,  0.0);   // yellow
    let c3 = vec3f(1.0,  0.97, 0.8);   // near-white tip
    let s  = clamp(t, 0.0, 1.0);
    if (s < 0.33) { return mix(c0, c1, s / 0.33); }
    if (s < 0.66) { return mix(c1, c2, (s - 0.33) / 0.33); }
    return mix(c2, c3, (s - 0.66) / 0.34);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let dims = vec2f(textureDimensions(screen));
    if (f32(gid.x) >= dims.x || f32(gid.y) >= dims.y) { return; }

    let coord = vec2f(f32(gid.x), f32(gid.y));

    // ── Depth occlusion ──────────────────────────────────────────────────────
    let fragDepth  = textureLoad(depth, vec2i(gid.xy), 0);
    let flameDepth = params.posFlame.z;

    var color = textureLoad(screen, vec2i(gid.xy));

    // If scene geometry is in front of the flame, skip
    if (fragDepth < flameDepth - 0.001) {
        textureStore(screen, vec2i(gid.xy), color);
        return;
    }

    let t = params.elapsedTime;

    // ── Screen-space flame coordinates ───────────────────────────────────────
    // posFlame.xy is in screen pixels; convert to normalised coords centred on flame
    let fx  = params.posFlame.x;
    let fy  = params.posFlame.y;

    // Aspect-corrected distance from flame centre
    let asp = dims.x / dims.y;
    let dx  = (coord.x - fx) / dims.y * asp * 14.0;  // tighter horizontally
    let dy  = (coord.y - fy) / dims.y * 14.0;

    // ── Radial envelope (teardrop / flame shape) ─────────────────────────────
    // Wider at the base, narrow at the tip.  dy negative = above flame origin.
    let dyN = -dy;                          // positive = upward
    let rx  = abs(dx) / (0.4 + 0.15 * max(dyN, 0.0));
    let ry  = abs(dy) / (0.7 + 0.4  * max(dyN, 0.0));
    let envelope = 1.0 - smoothstep(0.0, 1.0, sqrt(rx * rx + ry * ry));

    // Only compute inside the rough envelope
    if (envelope < 0.0001) {
        textureStore(screen, vec2i(gid.xy), color);
        return;
    }

    // ── Turbulent FBM noise ──────────────────────────────────────────────────
    let base = vec2f(dx, dy);

    let q = vec2f(
        fbm(base * 0.8 + vec2f(0.0,  t * 0.9)),
        fbm(base * 0.8 + vec2f(1.3,  t * 0.7) + 1.7)
    );

    // Sample noise texture for extra detail (UV wrapped in 0-1)
    let noiseUV   = fract(base * 0.15 + q * 0.12 + vec2f(0.0, -t * 0.25));
    let noiseSmpl = textureSampleLevel(channel0, bilinear_repeat, noiseUV, 0.0).r;

    let r = fbm(base + 3.5 * q + vec2f(noiseSmpl * 0.5, -t * 0.35));

    // ── Combine envelope + turbulence ────────────────────────────────────────
    // Rise: brighter near the base, fades to nothing at the tip
    let rise  = smoothstep(-0.5, 0.8, dyN);         // 0 below, 1 near tip
    let glow  = r * envelope * (1.0 - rise * 0.6);  // core glow

    let intensity = clamp(glow * 2.2 + r * 0.4, 0.0, 1.0);

    if (intensity < 0.005) {
        textureStore(screen, vec2i(gid.xy), color);
        return;
    }

    let fc   = flameColor(r * 1.4 - rise * 0.3);
    let alpha = clamp(intensity * 1.6, 0.0, 0.92);

    // Additive blend so flame naturally brightens the scene
    color = vec4f(color.rgb + fc * alpha * 1.8, 1.0);

    textureStore(screen, vec2i(gid.xy), color);
}
