
struct Uniforms {
theta: f32,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn main_vs(@location(0) pos: vec2f) -> @builtin(position) vec4f {
    let R: mat2x2<f32> = mat2x2<f32>(vec2f(cos(uniforms.theta), -sin(uniforms.theta)),
                  vec2f(sin(uniforms.theta),  cos(uniforms.theta)));
    return vec4f(R * pos, 0, 1);
}
@fragment
fn main_fs() -> @location(0) vec4f {
    return vec4f(1.0, 1.0, 1.0, 1.0);
}
