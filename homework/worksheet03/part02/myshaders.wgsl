struct Uniforms {
    mvp_arr: array<mat4x4f, 3>,
};
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) inPos: vec4f, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f {
    return uniforms.mvp_arr[instance] * inPos;
 }
/* 
@vertex
fn main_vs(@location(0) inPos: vec4f) -> @builtin(position) vec4f {
    return uniforms.mvp * inPos;
}
*/
@fragment
fn main_fs() -> @location(0) vec4f {
    return vec4f(0.0, 0.0, 0.0, 1.0);
}
