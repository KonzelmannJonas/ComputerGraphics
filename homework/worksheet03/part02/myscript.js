"use strict";
window.onload = function () { main(); }

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const canvas = document.getElementById('my-canvas');
    const one_point_button = document.getElementById('one-point');
    const two_point_button = document.getElementById('two-point');
    const three_point_button = document.getElementById('three-point');
    let draw_mode = 0; // 0: one point, 1: two point, 2: three point
    one_point_button.addEventListener('click', function () { draw_mode = 0; document.getElementById('draw-mode-text').innerText = "One point perspective mode"; });
    two_point_button.addEventListener('click', function () { draw_mode = 1; document.getElementById('draw-mode-text').innerText = "Two point perspective mode"; });
    three_point_button.addEventListener('click', function () { draw_mode = 2; document.getElementById('draw-mode-text').innerText = "Three point perspective mode"; });

    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });


    const point_size = 10 * (2 / canvas.height);
    var positions = [
        vec3(0.0, 0.0, 1.0),
        vec3(0.0, 1.0, 1.0),
        vec3(1.0, 1.0, 1.0),
        vec3(1.0, 0.0, 1.0),
        vec3(0.0, 0.0, 0.0),
        vec3(0.0, 1.0, 0.0),
        vec3(1.0, 1.0, 0.0),
        vec3(1.0, 0.0, 0.0),
    ];
    // Wireframe indices
    var wire_indices = new Uint32Array([
        0, 1, 1, 2, 2, 3, 3, 0, // front
        2, 3, 3, 7, 7, 6, 6, 2, // right
        0, 3, 3, 7, 7, 4, 4, 0, // down
        1, 2, 2, 6, 6, 5, 5, 1, // up
        4, 5, 5, 6, 6, 7, 7, 4, // back
        0, 1, 1, 5, 5, 4, 4, 0 // left
    ]);

    const indexBuffer = device.createBuffer({
        size: flatten(wire_indices).byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, flatten(wire_indices));

    /*
    var line_positions = [];
    for (let i = 0; i < wire_indices.length; i++) {
        var pos = positions[wire_indices[i]];
        line_positions.push(vec4(pos, 1.0));
    }
    console.log(line_positions.length);
*/
    const positionBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    console.log(positions.length);
    console.log(flatten(positions).byteLength);

    device.queue.writeBuffer(positionBuffer, 0, flatten(positions));
    const positionBufferLayout = {
        arrayStride: sizeof['vec4'],
        attributes: [{
            format: 'float32x4',
            offset: 0,
            shaderLocation: 0, // Position, see vertex shader
        }],
    };

    const wgslfile = document.getElementById('wgsl').src;
    const wgslcode
        = await fetch(wgslfile, { cache: "reload" }).then(r => r.text());
    const wgsl = device.createShaderModule({
        code: wgslcode
    });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs',
            buffers: [positionBufferLayout],
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs',
            targets: [{ format: canvasFormat }],
        },
        primitive: { topology: 'line-list', },
    });


    // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]
    /*
    const projection = mat4(1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, -0.5, 0.5,
        0.0, 0.0, 0.0, 1.0);
        */
    // const projection = ortho(-1.0, 1.0, -1.0, 1.0, -4.0, 2.0);
    // const view = lookAt(eye, lookat, up);

    /*
    const T = translate( 0.0, 0., 0.); // Model matrix translates the cube to the origin
    const Rx = rotateX(30);
    const Ry = rotateY(45);
    var alpha = 0.5
    const S = scalem(alpha, alpha, alpha);
    */

    // const mvp = mult(mult(T, mult(Rx, mult(Ry, S))), projection);

    // fill mvp array
    var mvp_arr = [];

    var eye = vec3(0, 0, 5);
    var lookat = vec3(0, 0, 0);
    var up = vec3(0.0, 1, 0.0);
    var projection = perspective(45, 1, 0.1, 100);
    var view = lookAt(eye, lookat, up);
    var T = translate(0, 0, 0);
    mvp_arr.push(mult(T, mult(projection, view)));

    eye = vec3(5, 0, 5);
    lookat = vec3(0, 0, 0);
    up = vec3(0.0, 1, 0.0);
    projection = perspective(45, 1, 0.1, 100);
    view = lookAt(eye, lookat, up);
    var T = translate(0, 0, 0);
    mvp_arr.push(mult(T, mult(projection, view)));

    eye = vec3(5, 5, 5);
    lookat = vec3(0, 0, 0);
    up = vec3(0.0, 1, 0.0);
    projection = perspective(45, 1, 0.1, 100);
    view = lookAt(eye, lookat, up);
    var T = translate(0, 0, 0);
    mvp_arr.push(mult(T, mult(projection, view)));

    const uniformBuffer = device.createBuffer({
        size: 3 * sizeof['mat4'],
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }],
    });
    device.queue.writeBuffer(uniformBuffer, 0, flatten(mvp_arr));

    // Create a render pass in a command buffer and submit it
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
        }],
    });
    // Insert render pass commands here
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, positionBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.setIndexBuffer(indexBuffer, "uint32");
    pass.drawIndexed(wire_indices.length, 3);
    // pass.draw(positions.length);

    pass.end();
    device.queue.submit([encoder.finish()])


}