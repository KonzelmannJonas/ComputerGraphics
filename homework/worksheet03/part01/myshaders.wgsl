struct Uniforms {
mvp: mat4x4f,
};
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) inPos: vec4f)
-> @builtin(position) vec4f
{
return uniforms.mvp*inPos;
}

@fragment
fn main_fs() -> @location(0) vec4f {
    return vec4f(0.0, 0.0, 0.0, 1.0);
}
