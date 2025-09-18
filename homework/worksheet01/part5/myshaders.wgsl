
struct Uniforms {
displacement: f32,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn main_vs(@location(0) pos: vec2f) -> @builtin(position) vec4f {
    let offset = vec2f(0.0, uniforms.displacement);
    return vec4f(pos + offset, 0, 1);
}
@fragment
fn main_fs() -> @location(0) vec4f {
    return vec4f(1.0, 1.0, 1.0, 1.0);
}
