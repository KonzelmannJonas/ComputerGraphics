"use strict";
window.onload = function () { main(); }

function add_point(array, point, size) {
    const offset = size / 2;
    var point_coords = [vec2(point[0] - offset, point[1] - offset), vec2(point[0] + offset, point[1] - offset),
    vec2(point[0] - offset, point[1] + offset), vec2(point[0] - offset, point[1] + offset),
    vec2(point[0] + offset, point[1] - offset), vec2(point[0] + offset, point[1] + offset)];
    array.push.apply(array, point_coords);
}

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const canvas = document.getElementById('my-canvas');
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    // add points for circle
    const radius = 0.5;
    var positions = [];
    const n = 50;
    for (let i = 0; i < n; i++) {
        const phi = i * 2 * Math.PI / n;
        const old_phi = (i - 1) * 2 * Math.PI / n;
        var point_coords = [vec2(0, 0),
        vec2(radius * Math.cos(phi), radius * Math.sin(phi)),
        vec2(radius * Math.cos(old_phi), radius * Math.sin(old_phi))];
        positions.push.apply(positions, point_coords);
    }

    const positionBuffer = device.createBuffer({
        size: flatten(positions).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBuffer, /*bufferOffset=*/0, flatten(positions));
    const positionBufferLayout = {
        arrayStride: sizeof['vec2'],
        attributes: [{
            format: 'float32x2',
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
        primitive: { topology: 'triangle-list', },
    });

    let bytelength = 5 * sizeof['vec4']; // Buffers are allocated in vec4 chunks
    let uniforms = new ArrayBuffer(bytelength);
    const uniformBuffer = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }],
    });

    let displacement = 0.0;
    let increment = 0.01;

    function render_frame(time) {
        if (displacement > 0.5) {
             increment *= -1;
        } else if (displacement < -0.5) {
             increment *= -1;
        }
        displacement += increment;
        const uniforms = new Float32Array([displacement]);
        device.queue.writeBuffer(uniformBuffer, /*bufferOffset=*/0, uniforms.buffer, 0, uniforms.byteLength);

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
        pass.draw(positions.length)

        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(render_frame);
    }
    requestAnimationFrame(render_frame);

}